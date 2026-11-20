import {httpsHostnameOrigin} from './origin.js';

function ocrEndpoint(env) {
  const origin = httpsHostnameOrigin(env.ORCL_OCR_ORIGIN);
  const token = String(env.ORCL_OCR_TOKEN || '');
  if (!origin || token.length < 32) return null;
  return {origin, token};
}

function configurationFailure(env) {
  const configured = Boolean(String(env.ORCL_OCR_ORIGIN || '').trim());
  const reasonCode = configured ? 'invalid_configuration' : 'not_configured';
  const reason = configured
    ? 'Oracle OCR requires an HTTPS origin with a DNS hostname and a valid token.'
    : 'Oracle OCR is not configured.';
  console.warn('Oracle OCR configuration is unavailable.', {reasonCode});
  return {status: 'unavailable', reasonCode, reason};
}

async function postOracle(endpoint, path, body, contentType, timeoutMs) {
  try {
    const response = await fetch(`${endpoint.origin}${path}`, {
      method: 'POST', headers: {'Content-Type': contentType, 'X-DCR-OCR-Token': endpoint.token},
      body, redirect: 'error', signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      console.warn('Oracle OCR request returned an error.', {path, upstreamStatus: response.status});
      return {status: 'unavailable', reasonCode: 'upstream_http_error', upstreamStatus: response.status,
        reason: `Oracle OCR returned HTTP ${response.status}.`};
    }
    const result = await response.json().catch(() => null);
    return result && typeof result === 'object' && !Array.isArray(result)
      ? result : {status: 'unavailable', reasonCode: 'invalid_response', reason: 'Oracle OCR returned an invalid response.'};
  } catch (cause) {
    const timedOut = cause?.name === 'TimeoutError' || cause?.name === 'AbortError';
    const reasonCode = timedOut ? 'timeout' : 'network_error';
    console.warn('Oracle OCR request could not complete.', {path, reasonCode, errorName: cause?.name || 'Error',
      errorCode: cause?.code || cause?.cause?.code || ''});
    return {status: 'unavailable', reasonCode, reason: timedOut
      ? 'Oracle OCR timed out.' : 'Oracle OCR service could not be reached.'};
  }
}

export async function identifyWithOracle(env, image, contentType) {
  const endpoint = ocrEndpoint(env);
  if (!endpoint) return configurationFailure(env);
  return postOracle(endpoint, '/ocr/v1/identify', image, contentType, 210000);
}

export async function resolveWithOracle(env, scanKeys, fields) {
  const endpoint = ocrEndpoint(env);
  if (!endpoint) return configurationFailure(env);
  return postOracle(endpoint, '/ocr/v1/resolve', JSON.stringify({scanKeys, fields}), 'application/json', 70000);
}
