export function normalizeCert(value) {
  const digits = String(value ?? '').trim();
  return /^\d{1,8}$/.test(digits) ? digits.padStart(8, '0') : '';
}

export function isValidCert(value) {
  return Boolean(normalizeCert(value));
}

export function makeCert() {
  const range = 100_000_000;
  const limit = Math.floor(0x100000000 / range) * range;
  const random = new Uint32Array(1);
  do crypto.getRandomValues(random); while (random[0] >= limit);
  return String(random[0] % range).padStart(8, '0');
}
