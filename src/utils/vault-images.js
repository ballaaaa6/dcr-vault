import {collectorNumbersCompatible} from './card-identification-matching.js';

const normalize = value => String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase();

export function findVaultImage(card, catalog, sources) {
  if (normalize(card.game) !== 'pokemon' || !card.cardNumber) return '';
  let matches = [];
  if (card.sourceLanguage && card.sourceCardId && ['matched', 'user_selected'].includes(card.identificationStatus)) {
    matches = catalog.filter(item => item.language === card.sourceLanguage && item.id === card.sourceCardId
      && collectorNumbersCompatible(card.cardNumber, item));
  } else {
    if (!card.name || !card.setName) return '';
    matches = catalog.filter(item => (!card.sourceLanguage || item.language === card.sourceLanguage)
      && normalize(item.name) === normalize(card.name) && normalize(item.setName) === normalize(card.setName)
      && (!card.year || String(item.year) === String(card.year)) && collectorNumbersCompatible(card.cardNumber, item));
  }
  if (matches.length !== 1) return '';
  return sources[`${matches[0].language}:${matches[0].id}`] || '';
}
