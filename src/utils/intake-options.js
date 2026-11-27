import {formatRarity} from './rarity.js';
import {collectorNumbersCompatible} from './card-identification-matching.js';

import {languageCode, languageName} from './card-language.js';
export {languageCode, languageName};

const normal = value => String(value || '').trim().normalize('NFKC').toLocaleLowerCase();

function fieldValue(card, field) {
  if (field === 'language') return languageName(card.language);
  if (field === 'series') return card.seriesName;
  if (card.language !== 'en' && field === 'name') return '';
  if (card.language !== 'en' && field === 'setName') return card.metadata?.englishSetName || '';
  return card[field] || '';
}

function matches(card, filters) {
  return filters.every(([key, value]) => {
    const actual = fieldValue(card, key);
    if (key === 'language') return languageCode(value) === card.language;
    if (key === 'rarity') return normal(formatRarity(actual)) === normal(formatRarity(value));
    if (key === 'cardNumber') return collectorNumbersCompatible(value, card);
    return normal(actual) === normal(value);
  });
}

export function catalogHasMatches(cards, values) {
  const filters = Object.entries(values).filter(([, value]) => normal(value));
  return cards.some(card => matches(card, filters));
}

export function catalogOptions(cards, field, values, limit = 60) {
  const query = normal(values[field]);
  const filters = Object.entries(values).filter(([key, value]) => key !== field && normal(value));
  const found = new Map();
  for (const card of cards) {
    if (!matches(card, filters)) continue;
    const value = fieldValue(card, field);
    if (!value || !normal(value).includes(query) || found.has(normal(value))) continue;
    found.set(normal(value), String(value));
  }
  return [...found.values()].sort((a, b) => a.localeCompare(b, 'en', {numeric: true})).slice(0, limit);
}
