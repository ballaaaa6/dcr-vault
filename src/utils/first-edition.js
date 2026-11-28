export function formatFirstEdition(setName, present) {
  const base = String(setName || '').trim().replace(/(?:\s*-\s*1st\s*)+$/i, '').trim();
  if (!base) return '';
  return present && base.length + 6 <= 120 ? `${base} - 1st` : base;
}
