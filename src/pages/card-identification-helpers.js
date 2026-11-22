import {formatRarity} from '../utils/rarity.js';
import {intakeValues} from '../utils/intake-reading.js';

export function fillMissingCatalogValues(fields, source, provenance, appliedValues) {
  const values = {...intakeValues(fields, source), artist: source.metadata?.illustrator || ''};
  for (const key of ['setName', 'year', 'rarity', 'artist']) {
    const input = document.getElementById(`m-${key}`);
    if (!input || input.value.trim() || provenance[key] === 'user' || !values[key]) continue;
    input.value = key === 'rarity' ? formatRarity(values[key]) : values[key];
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
