import {addCard, updateCard} from '../store/cards.js';
import {identificationProvenance, intakeClassification, logIdentificationStage} from './card-identification.js';

function formCard(certNumber) {
  const get = key => document.getElementById(`m-${key}`).value.trim();
  return {...identificationProvenance(), ...intakeClassification(), game: get('game'), name: get('name'), certNumber,
    setName: get('setName'), year: get('year'), cardTypeLabel: get('game'),
    languageLabel: '', sourceLanguage: get('language'), cardNumber: get('cardNumber'),
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

export async function updateIntakeCard(card) {
  const get = key => document.getElementById(`m-${key}`).value.trim();
  const patch = {game: get('game'), name: get('name'), setName: get('setName'), year: get('year'),
    sourceLanguage: get('language'), cardNumber: get('cardNumber'), rarity: get('rarity'), gradeLabel: get('grade'), artist: get('artist')};
  if (patch.game !== card.game) Object.assign(patch, {cardTypeLabel: patch.game, category: '', colorElements: [], subtypeDetail: '', pokemonTypes: '', trainerType: '', energyKind: '', energyType: ''});
  if (identificationProvenance().identificationStatus === 'unresolved') Object.assign(patch, intakeClassification());
  if (patch.setName !== card.setName) Object.assign(patch, {setSource: '', setNameLocal: patch.setName, setNameLocalSource: '', setNameEn: '', setNameEnSource: '', setNameEnType: ''});
  patch.inferredFields = (card.inferredFields || []).filter(field => {
    const key = field === 'set' ? 'setName' : field;
    return !(key in patch) || patch[key] === card[key];
  });
  await updateCard(card.id, patch);
  return card;
}
