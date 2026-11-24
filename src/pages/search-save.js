import {addCard} from '../store/cards.js';
import {displaySetName} from '../utils/set-name.js';
import {cardLabelMetadata} from '../utils/label-metadata.js';
import {resolveExactTypedCard} from './search-card-resolution.js';
import {identificationProvenance, intakeClassification, logIdentificationStage} from './card-identification.js';

function formCard(certNumber) {
  const selected = window.__intakeCatalogCard || window.__intakeIdentification || {};
  const metadata = cardLabelMetadata(selected);
  const sourceLanguage = document.getElementById('m-sourceLanguage').value.trim().toLowerCase();
  const sourceMatches = sourceLanguage && sourceLanguage === metadata.sourceLanguage;
  return {
    ...identificationProvenance(), ...intakeClassification(), game: document.getElementById('m-game').value.trim() === 'Pokémon TCG' ? 'pokemon' : document.getElementById('m-game').value.trim(), name: document.getElementById('m-name').value.trim(), certNumber,
    setName: displaySetName(document.getElementById('m-setName').value), year: document.getElementById('m-year').value.trim(),
    cardTypeLabel: document.getElementById('m-cardTypeLabel').value.trim(),
    series: document.getElementById('m-series').value.trim(), languageLabel: document.getElementById('m-languageLabel').value.trim(),
    yearSeries: metadata.yearSeries, catalogCardId: metadata.catalogCardId,
    sourceLanguage, sourceSetId: sourceMatches ? metadata.sourceSetId : '',
    sourceCardId: sourceMatches ? selected.sourceCardId || '' : '', sourceFinish: selected.sourceFinish || '',
    cardNumber: document.getElementById('m-cardNumber').value.trim(), rarity: document.getElementById('m-rarity').value.trim(),
    gradeLabel: document.getElementById('m-grade').value.trim(), artist: document.getElementById('m-artist').value.trim(),
    status: 'in-vault'
  };
}

export async function createIntakeCard(certNumber) {
  const language = window.__intakeIdentification?.sourceLanguage;
  if (!window.__intakeCatalogCard && (!language || language === 'en')) await resolveExactTypedCard();
  const input = formCard(certNumber);
  let card;
  try { card = await addCard(input); }
  catch (error) { logIdentificationStage('save', {outcome: 'error'}); throw error; }
  const values = Object.fromEntries(['name', 'setName', 'year', 'cardNumber', 'rarity'].map(key => [key, input[key]]));
  logIdentificationStage('save', {outcome: 'saved', values, provenance: input.fieldProvenance});
  window.__intakeSavedCard = card;
  return card;
}
