function ocrEndpoint(env) {
  const origin = String(env.ORCL_OCR_ORIGIN || '').replace(/\/+$/, '');
  const token = String(env.ORCL_OCR_TOKEN || '');
  if (!origin.startsWith('https://') || token.length < 32) return null;
  return {origin, token};
}

async function postOracle(endpoint, path, body, contentType, timeoutMs) {
  try {
    const response = await fetch(`${endpoint.origin}${path}`, {
      method: 'POST', headers: {'Content-Type': contentType, 'X-DCR-OCR-Token': endpoint.token},
      body, redirect: 'error', signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      console.warn('Oracle OCR request returned an error.', {path, status: response.status});
      return {status: 'unavailable', reason: `Oracle OCR returned HTTP ${response.status}.`};
    }
    const result = await response.json().catch(() => null);
    return result && typeof result === 'object' && !Array.isArray(result)
      ? result : {status: 'unavailable', reason: 'Oracle OCR returned an invalid response.'};
  } catch (cause) {
    const timedOut = cause?.name === 'TimeoutError' || cause?.name === 'AbortError';
    console.warn('Oracle OCR request could not complete.', {path, reason: timedOut ? 'timeout' : 'network'});
    return {status: 'unavailable', reason: timedOut
      ? 'Oracle OCR timed out.' : 'Oracle OCR service could not be reached.'};
  }
}

export async function identifyWithOracle(env, image, contentType) {
  const endpoint = ocrEndpoint(env);
  if (!endpoint) return null;
  return postOracle(endpoint, '/ocr/v1/identify', image, contentType, 210000);
}

export async function resolveWithOracle(env, scanKeys, fields) {
  const endpoint = ocrEndpoint(env);
  if (!endpoint) return null;
  return postOracle(endpoint, '/ocr/v1/resolve', JSON.stringify({scanKeys, fields}), 'application/json', 70000);
}
