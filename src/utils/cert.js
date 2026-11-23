export function normalizeCert(value) {
  const digits = String(value ?? '').trim();
  return /^\d{1,8}$/.test(digits) ? digits.padStart(8, '0') : '';
}

export function makeCert() {
  const range = 100_000_000;
  const limit = Math.floor(0x100000000 / range) * range;
  const random = new Uint32Array(1);
  do crypto.getRandomValues(random); while (random[0] >= limit);
  return String(random[0] % range).padStart(8, '0');
}

export async function findAvailableCert(check, previous = '', generate = makeCert) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = generate();
    if (candidate === normalizeCert(previous)) continue;
    const result = await check(candidate);
    if (result.available) return result.certNumber;
  }
  throw new Error('Could not find a free number. Try again.');
}

export function certificatePath(value) {
  return '/cert/' + encodeURIComponent(normalizeCert(value) || String(value ?? '').trim());
}

export function certificateFromPath(path) {
  const match = /^\/cert\/([^/]+)\/?$/.exec(path || '');
  return match ? match[1] : null;
}

export function publicCertificateUrl(value) {
  return 'https://dcrcards.pages.dev' + certificatePath(value);
}
