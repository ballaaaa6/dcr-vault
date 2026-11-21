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

export function parseCollectorNumber(value) {
  const printed = String(value ?? '').trim();
  const parts = printed.replace(/^#/, '').replace(/\s+/g, '').split('/');
  const head = parts[0].match(/^([a-z]*)(\d+)$/i);
  const tail = parts[1] || '';
  if (!head || parts.length > 2) return {printed, kind: 'unknown', number: '', prefix: '', denominator: '', promo: ''};
  const prefix = head[1].toUpperCase();
  const number = String(Number(head[2]));
  const numericTail = tail.match(/^([a-z]*)(\d+)$/i);
  const promo = tail && !numericTail ? tail.toUpperCase() : '';
  return {printed, kind: promo ? 'promo' : prefix ? 'prefixed' : 'numeric', prefix, number,
    denominator: numericTail ? `${numericTail[1].toUpperCase()}${Number(numericTail[2])}` : '', promo};
}

export function collectorNumbersCompatible(printed, card) {
  const [number, denominator] = numberParts(printed);
  const [catalogNumber, catalogDenominator] = numberParts(card.cardNumber);
  if (denominator && !/^\d+$/.test(denominator)) {
    return Boolean(number && number === catalogNumber && denominator === (catalogDenominator || normalized(card.setId)));
  }
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
  const printedNumber = parseCollectorNumber(fields.cardNumber);
  const rawCode = normalized(fields.setCode);
  const setCode = rawCode === normalized(fields.cardNumber) && printedNumber.promo
    ? normalized(printedNumber.promo) : rawCode;
  const number = String(fields.cardNumber || '').trim();
  const uncertain = (fields.uncertainFields || []).join(' ').toLowerCase();
  if (!language || !setCode || !number || readingConflicts(fields).length || /set.?code|collector.?number|card.?number/.test(uncertain)) return null;
  const name = normalized(fields.name);
  const matches = cards.filter(card => !card.metadata?.reviewRequired && normalized(card.language) === language
    && (card.metadata?.verifiedPrintedCodes || []).some(code => normalized(code) === setCode)
    && collectorNumbersCompatible(number, card)
    && (!name || [card.name, ...(card.metadata?.nameAliases || [])].some(alias => normalized(alias) === name))
    && (!fields.hp || !card.metadata?.hp || String(fields.hp).trim() === String(card.metadata.hp).trim())
    && (!fields.illustrator || !card.metadata?.illustrator || normalized(fields.illustrator) === normalized(card.metadata.illustrator)));
  return matches.length === 1 ? matches[0] : null;
}


export function findReadingCandidates(cards, fields, limit = 12) {
  const language = normalized(fields.language);
  const name = normalized(fields.name);
  const number = String(fields.cardNumber || '').trim();
  const uncertain = (fields.uncertainFields || []).join(' ').toLowerCase();
  if (!language || !number || /collector.?number|card.?number|language/.test(uncertain)) return [];
  const named = card => name && [card.name, ...(card.metadata?.nameAliases || [])]
    .some(alias => normalized(alias) === name);
  return cards.filter(card => normalized(card.language) === language
    && collectorNumbersCompatible(number, card)
    && (!fields.hp || !card.metadata?.hp || String(fields.hp).trim() === String(card.metadata.hp).trim())
    && (!fields.illustrator || !card.metadata?.illustrator
      || normalized(fields.illustrator) === normalized(card.metadata.illustrator)))
    .sort((a, b) => Number(Boolean(named(b))) - Number(Boolean(named(a))))
    .slice(0, limit);
}
