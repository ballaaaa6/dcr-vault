import {httpsHostnameOrigin} from './origin.js';

const OCR_TIMEOUT_MS = 210000;

function ocrEndpoint(env) {
  const origin = httpsHostnameOrigin(env.ORCL_OCR_ORIGIN || env.ORCL_MEDIA_ORIGIN);
  const token = String(env.ORCL_OCR_TOKEN || '');
  return origin && token.length >= 32 ? {origin, token} : null;
}

function configurationFailure(env, requestId) {
  const configured = Boolean(String(env.ORCL_OCR_ORIGIN || env.ORCL_MEDIA_ORIGIN || '').trim());
  const reasonCode = configured ? 'invalid_configuration' : 'not_configured';
  console.warn('Oracle OCR fallback is unavailable.', {requestId, reasonCode});
  return {status: 'unavailable', reasonCode};
}

function safeErrorDetails(cause) {
  return {
    errorName: String(cause?.name || 'Error').slice(0, 80),
    errorCode: String(cause?.code || cause?.cause?.code || '').slice(0, 80)
  };
}

async function postOracle(endpoint, body, contentType, requestId) {
  try {
    const response = await fetch(`${endpoint.origin}/ocr/v1/identify`, {
      method: 'POST', headers: {'Content-Type': contentType, 'X-DCR-OCR-Token': endpoint.token},
      body, redirect: 'manual', signal: AbortSignal.timeout(OCR_TIMEOUT_MS)
    });
    if (!response.ok) {
      console.warn('Oracle OCR fallback returned an error.', {requestId, upstreamStatus: response.status});
      return {status: 'unavailable', reasonCode: 'upstream_http_error', upstreamStatus: response.status};
    }
    const result = await response.json().catch(() => null);
    return result && typeof result === 'object' && !Array.isArray(result)
      ? result : {status: 'unavailable', reasonCode: 'invalid_response'};
  } catch (cause) {
    const timedOut = cause?.name === 'TimeoutError' || cause?.name === 'AbortError';
    console.warn('Oracle OCR fallback could not complete.', {requestId,
      reasonCode: timedOut ? 'timeout' : 'network_error', ...safeErrorDetails(cause)});
    return {status: 'unavailable', reasonCode: timedOut ? 'timeout' : 'network_error'};
  }
}

export async function identifyWithOracle(env, image, contentType, requestId) {
  const endpoint = ocrEndpoint(env);
  if (!endpoint) return configurationFailure(env, requestId);
  return postOracle(endpoint, image, contentType, requestId);
}
