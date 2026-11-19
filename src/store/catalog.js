let catalogPromise;
let catalogSetRarityOverrides = {};

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

function imageUrl(card) {
  const separator = card.id.lastIndexOf('-');
  const setId = card.setId || (separator > 0 ? card.id.slice(0, separator) : '');
  const localId = card.localId || (separator > 0 ? card.id.slice(separator + 1) : '');
  if (!card.language || !card.seriesId || !setId || !localId) return '';
  const query = new URLSearchParams({language: card.language, series: card.seriesId, set: setId, card: localId});
  return `/api/catalog/image?${query}`;
}

async function loadCatalog() {
  catalogPromise ||= fetch('/data/card-catalog.json', {cache: 'force-cache'})
    .then(response => {
      if (!response.ok) throw new Error('Card suggestions are temporarily unavailable.');
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data.cards) || ![1, 2, 3, 4].includes(data.schemaVersion)) throw new Error('Card catalog format is invalid.');
      catalogSetRarityOverrides = data.setRarityOverrides || {};
      return data.cards.map(([id, language, name, setName, year, cardNumber, rarity, seriesId, setId, seriesName]) => {
        const catalogSetId = String(setId ?? '');
        const recordedRarity = catalogRarity(rarity);
        const defaultRarity = language === 'en' ? catalogRarity(catalogSetRarityOverrides[catalogSetId]?.defaultRarity) : '';
        return {id: String(id ?? ''), language: String(language ?? ''), name: String(name ?? ''), setName: String(setName ?? ''),
          year: String(year ?? ''), cardNumber: String(cardNumber ?? ''), rarity: recordedRarity || defaultRarity,
          seriesId: String(seriesId ?? ''), setId: catalogSetId, seriesName: String(seriesName ?? '')};
      })
        .map(card => ({...card, imageUrl: imageUrl(card)}));
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
  const ordered = cards.filter(card => card.language === 'en' && matches(card, filters))
    .sort((left, right) => relevance(right, filters) - relevance(left, filters)
      || right.year.localeCompare(left.year) || left.name.localeCompare(right.name));
  const seen = new Set();
  return ordered.filter(card => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  }).slice(0, limit);
}

export async function findCatalogCardById(id) {
  const cards = await loadCatalog();
  return cards.find(card => card.language === 'en' && card.id === String(id || '')) || null;
}

export async function getCatalogRarities({setId = '', setName = ''} = {}) {
  const cards = await loadCatalog();
  const normalizedSet = normalize(setName);
  const scoped = cards.filter(card => card.language === 'en'
    && (setId ? card.setId === setId : normalizedSet && normalize(card.setName) === normalizedSet));
  const selectedSetId = setId || scoped[0]?.setId || '';
  const setOverride = catalogSetRarityOverrides[selectedSetId] || {};
  const override = Array.isArray(setOverride.rarities) ? setOverride.rarities : [];
  const rarities = [...new Set([...scoped.map(card => card.rarity).filter(Boolean), ...override.map(catalogRarity).filter(Boolean)])]
    .sort((left, right) => left.localeCompare(right, 'en', {sensitivity: 'base'}));
  return {rarities, noPrintedRarity: setOverride.noPrintedRarity === true};
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
  const name = Math.max(textSimilarity(card.name, fields.name), textSimilarity(card.name, fields.englishName));
  const set = Math.max(textSimilarity(card.setName, fields.setName), textSimilarity(card.setName, fields.englishSetName));
  const number = numberKey(card.cardNumber) && numberKey(card.cardNumber) === numberKey(fields.cardNumber) ? 1 : 0;
  const year = fields.year && card.year === fields.year ? 1 : 0;
  const language = fields.language && card.language === fields.language ? 1 : 0;
  const rarity = textSimilarity(card.rarity, fields.rarity);
  const hasNameAndContext = name >= 0.5 && (set >= 0.3 || number === 1);
  const hasSetAndNumber = set >= 0.5 && number === 1;
  const hasEvidence = hasNameAndContext || hasSetAndNumber;
  return hasEvidence ? name * 12 + set * 7 + number * 11 + year * 4 + language * 1.5 + rarity : 0;
}

function collectorNumberProximity(cardNumber, sourceNumber) {
  const cardKey = numberKey(cardNumber);
  const sourceKey = numberKey(sourceNumber);
  if (!cardKey || !sourceKey) return 0;
  const card = Number(cardKey);
  const source = Number(sourceKey);
  if (!Number.isFinite(card) || !Number.isFinite(source)) return 0;
  return Math.max(0, 2 - Math.abs(card - source) / 10);
}

function englishImageMatch(card, fields) {
  const name = textSimilarity(card.name, fields.englishName || (fields.language === 'en' ? fields.name : ''));
  const englishSetName = fields.englishSetName || (fields.language === 'en' ? fields.setName : '');
  const set = textSimilarity(card.setName, englishSetName);
  const broadTranslatedSet = fields.language !== 'en' && normalize(englishSetName) === normalize(card.seriesName);
  const specificSet = broadTranslatedSet ? 0 : set;
  const number = numberKey(card.cardNumber) && numberKey(card.cardNumber) === numberKey(fields.cardNumber) ? 1 : 0;
  const year = fields.year && card.year === fields.year ? 1 : 0;
  const rarity = textSimilarity(card.rarity, fields.rarity);
  const translatedNameEvidence = fields.language !== 'en' && name >= 0.95;
  const hasEvidence = translatedNameEvidence || (name >= 0.65 && (specificSet >= 0.3 || number === 1));
  const numberHint = translatedNameEvidence ? collectorNumberProximity(card.cardNumber, fields.cardNumber) : 0;
  return hasEvidence ? name * 12 + specificSet * 7 + number * 11 + year * 4 + rarity + numberHint : 0;
}

function bestSourceCard(cards, fields) {
  let best = null;
  cards.forEach(card => {
    if (fields.language && card.language !== fields.language) return;
    const name = textSimilarity(card.name, fields.name);
    const set = textSimilarity(card.setName, fields.setName);
    const number = numberKey(card.cardNumber) && numberKey(card.cardNumber) === numberKey(fields.cardNumber);
    if (name < 0.24 && !(set >= 0.3 && number)) return;
    const score = imageMatch(card, fields);
    if (score > 0 && (!best || score > best.score)) best = {card, score};
  });
  return best;
}

export async function findImageCandidates(fields, limit = 12) {
  const cards = await loadCatalog();
  const englishById = new Map(cards.filter(card => card.language === 'en').map(card => [card.id, card]));
  const bestMatches = new Map();
  const sourceMatch = bestSourceCard(cards, fields);
  cards.forEach(source => {
    if (fields.language && source.language !== fields.language) return;
    const sourceScore = imageMatch(source, fields);
    const english = englishById.get(source.id);
    const score = fields.language === 'en' ? englishImageMatch(english || {}, fields) : sourceScore;
    if (score <= 0 || !english) return;
    const current = bestMatches.get(english.id);
    if (!current || score > current.score) {
      bestMatches.set(english.id, {...english, catalogCardId: english.id,
        previewImage: source.imageUrl || english.imageUrl,
        previewImageFallback: source.imageUrl && source.imageUrl !== english.imageUrl ? english.imageUrl : '',
        sourceLanguage: source.language, sourceSetId: source.setId, score});
    }
  });
  cards.filter(card => card.language === 'en').forEach(english => {
    const matchScore = englishImageMatch(english, fields);
    if (matchScore <= 0) return;
    const score = matchScore + (sourceMatch?.score || 0) * 0.25;
    const current = bestMatches.get(english.id);
    if (current && current.score >= score) return;
    bestMatches.set(english.id, {...english, catalogCardId: english.id,
      previewImage: english.imageUrl, previewImageFallback: '',
      sourceLanguage: fields.language || 'en',
      sourceSetId: sourceMatch?.card.setId || (fields.language === 'en' ? english.setId : ''), score});
  });
  return [...bestMatches.values()].sort((left, right) => right.score - left.score
    || right.year.localeCompare(left.year) || left.name.localeCompare(right.name)).slice(0, limit);
}
