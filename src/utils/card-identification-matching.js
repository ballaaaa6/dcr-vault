function normalized(value) {
  return String(value ?? '').trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function numberKey(value) {
  const number = normalized(value).replace(/^#/, '').split('/')[0].replace(/\s+/g, '');
  return /^\d+$/.test(number) ? String(Number(number)) : number;
}

export function findExactCatalogCardFromCatalog(cards, fields) {
  const name = normalized(fields.name);
  const setName = normalized(fields.setName);
  const hasYear = Boolean(String(fields.year ?? '').trim());
  const hasNumber = Boolean(String(fields.cardNumber ?? '').trim());
  if (!name || !setName || !hasYear && !hasNumber) return null;
  const matches = cards.filter(card => card.language === 'en'
    && normalized(card.name) === name && normalized(card.setName) === setName
    && (!hasYear || String(card.year ?? '').trim() === String(fields.year).trim())
    && (!hasNumber || numberKey(card.cardNumber) === numberKey(fields.cardNumber)));
  return matches.length === 1 ? matches[0] : null;
}
