import {CARD_READING_PROMPT, CARD_READING_SCHEMA} from './card-reader-contract.js';
import {normalizeCardReading} from './card-reader-normalization.js';
import {parseJsonText} from './gemini-card-reader.js';

export const ZAI_MODEL = 'glm-4.6v-flash';

function failure(code, upstreamStatus = 0) {
  return Object.assign(new Error(code), {code, upstreamStatus});
}

function base64(bytes) {
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(parts.join(''));
}

export async function analyzeWithZai(env, body, contentType, requestId, onParsed = () => {}, model = ZAI_MODEL) {
  if (!env.ZAI_API_KEY) throw failure('not_configured');
  let response;
  try {
    response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(45000),
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${env.ZAI_API_KEY}`},
      body: JSON.stringify({model, temperature: 0, thinking: {type: 'disabled'}, messages: [{role: 'user', content: [
        {type: 'text', text: `${CARD_READING_PROMPT}\nReturn only JSON matching this schema: ${JSON.stringify(CARD_READING_SCHEMA)}`},
        {type: 'image_url', image_url: {url: `data:${contentType};base64,${base64(body)}`}}
      ]}]})
    });
  } catch (cause) {
    throw failure(cause?.name === 'TimeoutError' || cause?.name === 'AbortError' ? 'timeout' : 'network_error');
  }
  if (!response.ok) {
    const code = response.status === 429 ? 'quota' : [400, 401, 403, 404].includes(response.status) ? 'configuration' : 'upstream';
    throw failure(code, response.status);
  }
  const output = await response.json().catch(() => null);
  const parsed = parseJsonText(output?.choices?.[0]?.message?.content || '');
  onParsed(parsed);
  return normalizeCardReading(parsed);
}
