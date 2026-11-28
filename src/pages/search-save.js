import {addCard} from '../store/cards.js';
import {identificationProvenance, intakeClassification, logIdentificationStage} from './card-identification.js';

function formCard(certNumber) {
  const get = key => document.getElementById(`m-${key}`).value.trim();
  return {...identificationProvenance(), ...intakeClassification(), game: get('game'), name: get('name'), certNumber,
    setName: get('setName'), year: get('year'), cardTypeLabel: get('game'),
    languageLabel: get('languageLabel'), sourceLanguage: get('sourceLanguage'), cardNumber: get('cardNumber'),
    rarity: get('rarity'), gradeLabel: get('grade'), artist: get('artist'), status: 'in-vault'};
}

export async function createIntakeCard(certNumber) {
  const input = formCard(certNumber);
  let card;
  try { card = await addCard(input); }
  catch (error) { logIdentificationStage('save', {outcome: 'error'}); throw error; }
  const values = Object.fromEntries(['name', 'setName', 'year', 'cardNumber', 'rarity'].map(key => [key, input[key]]));
  logIdentificationStage('save', {outcome: 'saved', values, yearSource: input.yearSource, setValueSource: input.fieldProvenance.setName === 'user' ? 'user' : input.setName ? 'gemini' : '', provenance: input.fieldProvenance});
  window.__intakeSavedCard = card;
  return card;
}
