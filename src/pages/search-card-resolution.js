import {findExactCatalogCard} from '../store/catalog.js';
import {cardLabelMetadata} from '../utils/label-metadata.js';

let resolutionVersion = 0;

export function invalidateCardResolution() {
  resolutionVersion += 1;
}

export function initializeCardRarity() {
  invalidateCardResolution();
  document.getElementById('m-rarity').value = '';
}

export function selectCatalogSuggestion(card) {
  const sourceLanguage = window.__intakeIdentification?.sourceLanguage || window.__intakeIdentification?.language || 'en';
  const selected = {...card, sourceLanguage, sourceSetId: sourceLanguage === 'en' ? card.setId : ''};
  window.__intakeCatalogCard = selected;
  window.__intakeCatalogGame = 'pokemon';
  return cardLabelMetadata(selected);
}

export async function resolveExactTypedCard() {
  if (window.__intakeCatalogCard) return window.__intakeCatalogCard;
  const version = ++resolutionVersion;
  const fields = Object.fromEntries(['name', 'setName', 'year', 'cardNumber']
    .map(field => [field, document.getElementById(`m-${field}`).value.trim()]));
  try {
    const card = await findExactCatalogCard(fields);
    if (version !== resolutionVersion || window.__intakeCatalogCard || !card) return null;
    selectCatalogSuggestion(card);
    document.getElementById('m-rarity').value = card.rarity || '';
    return selected;
  } catch {
    return null;
  }
}
