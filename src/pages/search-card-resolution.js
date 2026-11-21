import {findExactCatalogCard} from '../store/catalog.js';

let resolutionVersion = 0;

export function invalidateCardResolution() {
  resolutionVersion += 1;
}

export function initializeCardRarity() {
  invalidateCardResolution();
  document.getElementById('m-rarity').value = '';
}

export async function resolveExactTypedCard() {
  if (window.__intakeCatalogCard) return window.__intakeCatalogCard;
  const version = ++resolutionVersion;
  const fields = Object.fromEntries(['name', 'setName', 'year', 'cardNumber']
    .map(field => [field, document.getElementById(`m-${field}`).value.trim()]));
  try {
    const card = await findExactCatalogCard(fields);
    if (version !== resolutionVersion || window.__intakeCatalogCard || !card) return null;
    const selected = {...card, sourceLanguage: 'en', sourceSetId: card.setId};
    window.__intakeCatalogCard = selected;
    window.__intakeCatalogGame = 'pokemon';
    document.getElementById('m-rarity').value = card.rarity || '';
    return selected;
  } catch {
    return null;
  }
}
