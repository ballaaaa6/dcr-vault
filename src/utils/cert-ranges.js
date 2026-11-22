import {normalizeCert} from './cert.js';

export function parseCertRanges(input, limit = 500) {
  const values = new Set();
  const parts = input.trim().split(/[,\n]/);
  if (!input.trim() || parts.some(part => !part.trim())) throw new Error('Enter certificate numbers or ranges separated by commas.');
  for (const part of parts) {
    const match = /^\s*(\d{1,8})(?:\s*-\s*(\d{1,8}))?\s*$/.exec(part);
    if (!match) throw new Error(`Invalid certificate range: ${part.trim()}`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (end < start) throw new Error(`Range must start with the smaller number: ${part.trim()}`);
    if (end - start + 1 > limit) throw new Error(`Please search at most ${limit} certificate numbers at a time.`);
    for (let number = start; number <= end; number += 1) {
      values.add(normalizeCert(number));
      if (values.size > limit) throw new Error(`Please search at most ${limit} certificate numbers at a time.`);
    }
  }
  return [...values];
}
