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
    if (!response.ok) return null;
    const result = await response.json().catch(() => null);
    return result && typeof result === 'object' && !Array.isArray(result) ? result : null;
  } catch {
    return null;
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
