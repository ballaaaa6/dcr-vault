function normalized(value) {
  return String(value ?? '').trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function findExactCatalogCardFromCatalog(cards, fields) {
  const name = normalized(fields.name);
  const setName = normalized(fields.setName);
  const hasYear = Boolean(String(fields.year ?? '').trim());
  const hasNumber = Boolean(String(fields.cardNumber ?? '').trim());
  if (!name || !setName || !hasYear && !hasNumber) return null;
  const matches = cards.filter(card => card.language === 'en'
    && normalized(card.name) === name && normalized(card.setName) === setName
    && (!hasNumber || collectorNumbersCompatible(fields.cardNumber, card)));
  if (matches.length === 1 && hasNumber) return matches[0];
  const dated = matches.filter(card => hasYear && String(card.year ?? '').trim() === String(fields.year).trim());
  return dated.length === 1 ? dated[0] : null;
}

function numberParts(value) {
  const parts = normalized(value).replace(/^#/, '').split('/').map(part => part.replace(/\s+/g, ''));
  const key = part => /^\d+$/.test(part) ? String(Number(part)) : part;
  return parts.map(key);
}

export function collectorNumbersCompatible(printed, card) {
  const [number, denominator] = numberParts(printed);
  const [catalogNumber, catalogDenominator] = numberParts(card.cardNumber);
  const expectedDenominator = catalogDenominator || numberParts(card.metadata?.cardCount || '')[0];
  return Boolean(number && number === catalogNumber && (!denominator || !expectedDenominator || denominator === expectedDenominator));
}

export function readingConflicts(fields) {
  const text = [fields.stamp, fields.identificationSummary, ...(fields.evidence || [])].join(' ');
  const anniversary = number => new RegExp(`\\b${number}(?:th\\b|\\s+(?:anniversary|stamp)\\b)`, 'i').test(text);
  return anniversary(25) && anniversary(30) ? ['anniversary stamp'] : [];
}

export function findSourceCatalogCardFromCatalog(cards, fields) {
  const language = normalized(fields.language);
  const setCode = normalized(fields.setCode);
  const number = String(fields.cardNumber || '').trim();
  const uncertain = (fields.uncertainFields || []).join(' ').toLowerCase();
  if (!language || !setCode || !number || readingConflicts(fields).length || /set.?code|collector.?number|card.?number/.test(uncertain)) return null;
  const name = normalized(fields.name);
  const matches = cards.filter(card => normalized(card.language) === language
    && normalized(card.setId) === setCode && collectorNumbersCompatible(number, card)
    && (!name || [card.name, ...(card.metadata?.nameAliases || [])].some(alias => normalized(alias) === name))
    && (!fields.hp || !card.metadata?.hp || String(fields.hp).trim() === String(card.metadata.hp).trim()));
  return matches.length === 1 ? matches[0] : null;
}
