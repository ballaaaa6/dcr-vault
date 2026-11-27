import {normalizeCardReading} from './card-reader-normalization.js';
import {CARD_READING_PROMPT, CARD_READING_SCHEMA} from './card-reader-contract.js';
import {reserveKey, recordAttempt, keyIdentifier} from './gemini-usage.js';

export const MODEL = 'gemini-3.6-flash';
const API_TIMEOUT_MS = 45000;
const RETRY_DELAY_MS = 400;
const READING_KEYS = ['game', 'language', 'name', 'set', 'series', 'year', 'card_number', 'rarity', 'category', 'color_element', 'subtype_detail'];

function base64(bytes) {
  const pieces = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    pieces.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(pieces.join(''));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasReadingKeys(value) {
  return isObject(value) && READING_KEYS.some(key => Object.prototype.hasOwnProperty.call(value, key));
}

function findReadingObject(value, depth = 0) {
  if (hasReadingKeys(value)) return value;
  if (!isObject(value) || depth >= 4) return null;
  for (const key of ['fields', 'card', 'reading', 'data', 'result', 'response', 'output']) {
    const found = findReadingObject(value[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(item => typeof item === 'string' ? item : item?.text || '').join('\n');
  if (Array.isArray(content?.parts)) return textFromContent(content.parts);
  if (typeof content?.text === 'string') return content.text;
  if (typeof content?.content === 'string') return content.content;
  return '';
}

function outputText(output) {
  const candidates = [output?.candidates?.[0]?.content?.parts, output?.text];
  for (const candidate of candidates) {
    const text = textFromContent(candidate);
    if (text) return text;
  }
  return '';
}

function parseJsonText(text) {
  const source = text.trim().replace(/^\s*\x60{3}(?:json)?\s*/i, '').replace(/\s*\x60{3}\s*$/, '');
  try {
    const reading = findReadingObject(JSON.parse(source));
    if (reading) return reading;
  } catch {}
  for (let start = 0; start < source.length; start += 1) {
    if (source[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let end = start; end < source.length; end += 1) {
      const char = source[end];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
      } else if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      if (depth === 0) {
        try {
          const reading = findReadingObject(JSON.parse(source.slice(start, end + 1)));
          if (reading) return reading;
        } catch {}
        break;
      }
    }
  }
  return null;
}

function parseOutput(output) {
  return findReadingObject(output) || parseJsonText(outputText(output));
}

function responseDiagnostics(output, parsed) {
  const candidates = Array.isArray(output?.candidates) ? output.candidates : [];
  const candidate = candidates[0];
  const parts = candidate?.content?.parts;
  const usage = output?.usageMetadata;
  const keysIn = value => isObject(value) ? READING_KEYS.filter(key => key in value) : [];
  return {
    outputKeys: isObject(output) ? Object.keys(output).slice(0, 12) : [],
    candidateCount: candidates.length,
    finishReason: candidate?.finishReason || null,
    partCount: Array.isArray(parts) ? parts.length : 0,
    parsedKeys: keysIn(parsed),
    textLength: outputText(output).length,
    usage: usage ? {
      promptTokens: Number.isFinite(usage.promptTokenCount) ? usage.promptTokenCount : null,
      completionTokens: Number.isFinite(usage.candidatesTokenCount) ? usage.candidatesTokenCount : null,
      totalTokens: Number.isFinite(usage.totalTokenCount) ? usage.totalTokenCount : null
    } : null
  };
}

function readingError(code, status, upstreamStatus = 0) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  error.upstreamStatus = upstreamStatus;
  return error;
}

function retryableFailure(cause) {
  return cause?.code === 'network_error' || cause?.code === 'upstream' && cause.upstreamStatus >= 500;
}

function canFailOver(cause) {
  return ['key_rejected', 'configuration', 'timeout', 'network_error', 'upstream'].includes(cause?.code);
}

function safeDiagnosticMessage(value) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/AIza[\w-]{20,}/g, '[redacted]').slice(0, 180);
}

function fetchDiagnostics(cause, elapsedMs) {
  return {
    errorName: String(cause?.name || 'Error').slice(0, 80),
    errorCode: String(cause?.code || '').slice(0, 80),
    causeName: String(cause?.cause?.name || '').slice(0, 80),
    causeCode: String(cause?.cause?.code || '').slice(0, 80),
    errorMessage: safeDiagnosticMessage(cause?.message),
    causeMessage: safeDiagnosticMessage(cause?.cause?.message),
    elapsedMs
  };
}

async function postGemini(apiKey, payload, track, model) {
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': apiKey},
      body: payload, redirect: 'manual', signal: AbortSignal.timeout(API_TIMEOUT_MS)
    });
  } catch (cause) {
    const failure = readingError(cause?.name === 'TimeoutError' || cause?.name === 'AbortError' ? 'timeout' : 'network_error', 503);
    failure.diagnostics = fetchDiagnostics(cause, Date.now() - startedAt);
    await track(failure.code, null, null);
    throw failure;
  }
  const output = await response.json().catch(() => null);
  if (response.ok) {
    await track('success', response.status, output?.usageMetadata);
    return output;
  }
  const failure = upstreamError(response.status, output);
  await track(failure.code, response.status, output?.usageMetadata);
  throw failure;
}

function upstreamError(status, body) {
  const details = body?.error;
  const text = [details?.status, details?.message,
    ...(Array.isArray(details?.details) ? details.details.flatMap(item => [item?.reason, item?.domain]) : [])]
    .filter(value => typeof value === 'string').join(' ');
  if (status === 429 || /resource_exhausted|quota|rate.?limit/i.test(text)) return readingError('quota', 429, status);
  if (status === 401 || /API_KEY_INVALID|API_KEY_(?:SERVICE|IP_ADDRESS|HTTP_REFERRER)_BLOCKED|API key.{0,50}(?:invalid|not valid|blocked|disabled|revoked|expired)|(?:invalid|not valid).{0,50}API key/i.test(text)) {
    return readingError('key_rejected', 503, status);
  }
  if ([400, 401, 403, 404].includes(status)) return readingError('configuration', 503);
  return readingError('upstream', 503, status);
}

export function configuredApiKeys(env) {
  const pool = String(env.GEMINI_API_KEYS || '').split(/[\r\n,;]+/).map(key => key.trim()).filter(Boolean);
  const legacyKey = String(env.GEMINI_API_KEY || '').trim();
  return [...new Set([...pool, legacyKey].filter(Boolean))];
}

export async function analyzeWithGemini(env, body, contentType, requestId, onParsed = () => {}, model = MODEL) {
  const apiKeys = configuredApiKeys(env);
  if (!apiKeys.length) throw readingError('not_configured', 503);
  const payload = JSON.stringify({contents: [{role: 'user', parts: [
    {text: CARD_READING_PROMPT}, {inline_data: {mime_type: contentType, data: base64(body)}}
  ]}], generationConfig: {temperature: 0, maxOutputTokens: 3072, responseMimeType: 'application/json', responseJsonSchema: CARD_READING_SCHEMA}});
  for (let index = 0; index < apiKeys.length; index += 1) {
    try {
      const slot = env.DB ? await reserveKey(env.DB, apiKeys.length) : index;
      const keyId = await keyIdentifier(apiKeys[slot]);
      const track = (outcome, status, usage) => recordAttempt(env.DB, {requestId, slot, keyId, outcome, status, usage, model});
      const output = await postGemini(apiKeys[slot], payload, track, model);
      const parsed = parseOutput(output);
      onParsed(parsed);
      const fields = normalizeCardReading(parsed);
      if (!fields) console.warn('Gemini returned no identity fields.', {model, ...responseDiagnostics(output, parsed)});
      return fields;
    } catch (cause) {
      if (!canFailOver(cause)) throw cause;
      if (index === apiKeys.length - 1) {
        if (cause?.code === 'key_rejected') throw readingError('configuration', 503);
        throw cause;
      }
      console.warn('Gemini request failed; trying the next configured API key.', {model, requestId,
        reasonCode: cause.code, upstreamStatus: cause.upstreamStatus || null});
      if (retryableFailure(cause)) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw readingError('configuration', 503);
}
