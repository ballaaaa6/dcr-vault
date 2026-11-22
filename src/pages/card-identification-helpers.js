import {formatRarity} from '../utils/rarity.js';
import {intakeValues} from '../utils/intake-reading.js';

const languageNames = {ja: 'JAPANESE', th: 'THAI', ko: 'KOREAN', 'zh-tw': 'CHINESE',
  'zh-cn': 'CHINESE', de: 'GERMAN', fr: 'FRENCH', es: 'SPANISH', it: 'ITALIAN',
  pt: 'PORTUGUESE', id: 'INDONESIAN', nl: 'DUTCH', pl: 'POLISH', ru: 'RUSSIAN'};

export function standardLabelValues(fields) {
  const game = String(fields.cardTypeLabel || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isPokemon = /\bpokemon\b/.test(game);
  const language = fields.language;
  return {cardTypeLabel: isPokemon ? 'POKÉMON' : '', languageLabel: languageNames[language] || ''};
}

function comparableSetName(value) {
  const name = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const promo = name.match(/^([a-z0-9]+-p) (?:promo|promos|promotional cards?)$/);
  return promo ? `${promo[1]} promos` : name;
}

export function catalogDifferences(values, source) {
  if (!source) return [];
  const expected = intakeValues({...source, form: {}, language: source.language}, source);
  return ['name', 'setName', 'year', 'rarity'].filter(key => {
    const normalize = key === 'setName' ? comparableSetName : value => value.trim().toLowerCase();
    return values[key] && expected[key] && normalize(values[key]) !== normalize(expected[key]);
  }).map(key => `${key}: Gemini ${values[key]} / catalog ${expected[key]}`);
}

export function fillMissingCatalogValues(fields, source, provenance, appliedValues) {
  const values = {...intakeValues({...source, form: {}, language: source.language}, source),
    cardNumber: source.metadata?.verifiedPrintedNumber || '', artist: source.metadata?.illustrator || ''};
  for (const key of ['name', 'setName', 'year', 'cardNumber', 'rarity', 'artist']) {
    const input = document.getElementById(`m-${key}`);
    if (!input || provenance[key] === 'user' || !values[key]) continue;
    const value = key === 'rarity' ? formatRarity(values[key]) : values[key];
    const normalize = key === 'setName' ? comparableSetName : value => String(value).trim().toLowerCase();
    if (normalize(input.value) === normalize(value)) continue;
    input.value = value;
    provenance[key] = 'catalog';
    if (appliedValues) appliedValues[key] = input.value;
    window.dispatchEvent(new Event('intake-values-updated'));
  }
}

export function safeReadingErrorMessage(error) {
  if (/not configured/i.test(error?.message || '')) return 'Card reading is not configured for this deployment.';
  if (error?.code === 'gemini_quota' || error?.status === 429) return 'Gemini request quota was reached. Try again later.';
  if (error?.code === 'gemini_configuration') return 'Gemini API settings need to be fixed by the site administrator.';
  if (error?.status === 503) return 'Gemini card reading is temporarily unavailable. Try again in a moment.';
  if (error?.status === 422) return 'Gemini could not identify this card. Try a clearer front image.';
  return error?.message || 'Card reading could not be completed. Try again in a moment.';
}

export function canRetryIdentification(error) {
  return error?.status === 429 || error?.status >= 500 || !error?.status;
}
