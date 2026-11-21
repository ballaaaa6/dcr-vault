import {findExactCatalogCardFromCatalog, findImageCandidatesFromCatalog, findImageReviewCandidatesFromCatalog} from '../utils/card-identification-matching.js';

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

function catalogMetadata(value) {
  if (!Array.isArray(value)) return value && typeof value === 'object' ? value : {};
  const [nameAliases = [], cardCount = '', hp = '', illustrator = '', stage = '', types = [], attackRows = [], abilityRows = [],
    weaknessRows = [], resistanceRows = [], retreat = '', evolvesFrom = '', variants = []] = value;
  const attacks = attackRows.map(([names = [], damage = '', cost = [], effects = []]) => ({names, damage, cost, effects}));
  const abilities = abilityRows.map(row => Array.isArray(row?.[0])
    ? {names: row[0], effects: row[1] || []} : {names: row});
  const relations = rows => rows.map(([type = '', relationValue = '']) => ({type, value: relationValue}));
  return {nameAliases, cardCount, hp, illustrator, stage, types, attacks, abilities,
    weaknesses: relations(weaknessRows), resistances: relations(resistanceRows), retreat, evolvesFrom, variants};
}

function imageParts(card) {
  const separator = card.id.lastIndexOf('-');
  const setId = card.setId || (separator > 0 ? card.id.slice(0, separator) : '');
  const localId = card.localId || (separator > 0 ? card.id.slice(separator + 1) : '');
  if (!card.language || !card.seriesId || !setId || !localId) return '';
  return [card.language, card.seriesId, setId, localId];
}

function imagePath(card) {
  const parts = imageParts(card);
  return parts ? parts.map(encodeURIComponent).join('/') : '';
}

function imageUrl(card) {
  const parts = imageParts(card);
  if (!parts) return '';
  const [language, series, set, localId] = parts;
  const query = new URLSearchParams({language, series, set, card: localId});
  return `/api/catalog/image?${query}`;
}

function imageFallbackUrl(card) {
  const path = imagePath(card);
  return path ? `https://assets.tcgdex.net/${path}/low.webp` : '';
}

async function loadCatalog() {
  catalogPromise ||= fetch('/data/card-catalog.json', {cache: 'force-cache'})
    .then(response => {
      if (!response.ok) throw new Error('Card suggestions are temporarily unavailable.');
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data.cards) || ![1, 2, 3, 4, 5, 6].includes(data.schemaVersion)) throw new Error('Card catalog format is invalid.');
      catalogSetRarityOverrides = data.setRarityOverrides || {};
      return data.cards.map(([id, language, name, setName, year, cardNumber, rarity, seriesId, setId, seriesName, metadata]) => {
        const catalogSetId = String(setId ?? '');
        const recordedRarity = catalogRarity(rarity);
        const defaultRarity = language === 'en' ? catalogRarity(catalogSetRarityOverrides[catalogSetId]?.defaultRarity) : '';
        return {id: String(id ?? ''), language: String(language ?? ''), name: String(name ?? ''), setName: String(setName ?? ''),
          year: String(year ?? ''), cardNumber: String(cardNumber ?? ''), rarity: recordedRarity || defaultRarity,
          seriesId: String(seriesId ?? ''), setId: catalogSetId, seriesName: String(seriesName ?? ''),
          metadata: catalogMetadata(metadata)};
      })
        .map(card => ({...card, imageUrl: imageUrl(card), imageUrlFallback: imageFallbackUrl(card)}));
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

export async function findExactCatalogCard(fields) {
  return findExactCatalogCardFromCatalog(await loadCatalog(), fields);
}

export async function findImageCandidates(fields, limit = 12) {
  const cards = await loadCatalog();
  return findImageCandidatesFromCatalog(cards, fields, limit);
}

export async function findImageReviewCandidates(fields, limit = 12) {
  const cards = await loadCatalog();
  return findImageReviewCandidatesFromCatalog(cards, fields, limit);
}
