let catalogPromise;

function normalize(value) {
  return String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase();
}

function numberKey(value) {
  const number = normalize(value).replace(/^#/, '').split('/')[0].replace(/\s+/g, '');
  return /^\d+$/.test(number) ? String(Number(number)) : number;
}

function catalogRarity(value) {
  const rarity = String(value ?? '').trim();
  return ['none', 'null', 'undefined'].includes(rarity.toLowerCase()) ? '' : rarity;
}

async function loadCatalog() {
  catalogPromise ||= fetch('/data/card-catalog.json', {cache: 'force-cache'})
    .then(response => {
      if (!response.ok) throw new Error('Card suggestions are temporarily unavailable.');
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data.cards)) throw new Error('Card catalog format is invalid.');
      return data.cards.map(([id, language, name, setName, year, cardNumber, rarity]) =>
        ({id: String(id ?? ''), language: String(language ?? ''), name: String(name ?? ''), setName: String(setName ?? ''),
          year: String(year ?? ''), cardNumber: String(cardNumber ?? ''), rarity: catalogRarity(rarity)}));
    });
  return catalogPromise;
}

function matches(card, filters) {
  return filters.every(([field, query]) => {
    const value = field === 'cardNumber' ? numberKey(card[field]) : normalize(card[field]);
    const needle = field === 'cardNumber' ? numberKey(query) : normalize(query);
    return value.includes(needle);
  });
}

function relevance(card, filters) {
  return filters.reduce((score, [field, query]) => {
    const value = field === 'cardNumber' ? numberKey(card[field]) : normalize(card[field]);
    const needle = field === 'cardNumber' ? numberKey(query) : normalize(query);
    return score + (value === needle ? 4 : value.startsWith(needle) ? 2 : 0);
  }, card.language === 'en' ? 1 : 0);
}

export async function findCatalogCandidates(values, limit = 12) {
  const filters = Object.entries(values).filter(([, value]) => String(value ?? '').trim());
  if (!filters.length) return [];
  const cards = await loadCatalog();
  const ordered = cards.filter(card => matches(card, filters))
    .sort((left, right) => relevance(right, filters) - relevance(left, filters)
      || right.year.localeCompare(left.year) || left.name.localeCompare(right.name));
  const seen = new Set();
  return ordered.filter(card => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  }).slice(0, limit);
}

function characterGrams(value) {
  const chars = [...normalize(value).replace(/[\s\p{P}\p{S}]/gu, '')];
  if (chars.length < 2) return new Set(chars);
  return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]));
}

function textSimilarity(leftValue, rightValue) {
  const left = normalize(leftValue).replace(/[\s\p{P}\p{S}]/gu, '');
  const right = normalize(rightValue).replace(/[\s\p{P}\p{S}]/gu, '');
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length > 1 && (left.includes(right) || right.includes(left))) return 0.88;
  const leftGrams = characterGrams(left);
  const rightGrams = characterGrams(right);
  const shared = [...leftGrams].filter(gram => rightGrams.has(gram)).length;
  return (2 * shared) / (leftGrams.size + rightGrams.size);
}

function imageMatch(card, fields) {
  const name = textSimilarity(card.name, fields.name);
  const set = textSimilarity(card.setName, fields.setName);
  const number = numberKey(card.cardNumber) && numberKey(card.cardNumber) === numberKey(fields.cardNumber) ? 1 : 0;
  const year = fields.year && card.year === fields.year ? 1 : 0;
  const language = fields.language && card.language === fields.language ? 1 : 0;
  const rarity = textSimilarity(card.rarity, fields.rarity);
  const hasEvidence = name >= 0.24 || set >= 0.3 || number === 1;
  return hasEvidence ? name * 12 + set * 7 + number * 11 + year * 4 + language * 1.5 + rarity : 0;
}

export async function findImageCandidates(fields, limit = 8) {
  const cards = await loadCatalog();
  return cards.map(card => ({card, score: imageMatch(card, fields)}))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || right.card.year.localeCompare(left.card.year))
    .slice(0, limit).map(item => item.card);
}
