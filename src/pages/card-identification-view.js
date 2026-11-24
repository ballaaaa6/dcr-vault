import {escapeHTML} from '../utils/format.js';
import {classificationFields} from '../utils/card-classification.js';
import {dropdown} from '../components/dropdown.js';

const choices = {category: ['Pokemon', 'Trainer', 'Energy'], pokemonTypes: ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless'], trainerType: ['Item', 'Supporter', 'Stadium', 'Pokemon Tool'], energyKind: ['Basic', 'Special'], energyType: ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy']};

function classificationMarkup(key, label, value) {
  const options = ['', ...choices[key]];
  if (value && !options.includes(value)) options.push(value);
  return `<div class="identification-read-field identification-classification" data-classification-row="${key}"><b>${escapeHTML(label)}</b>${dropdown({id: `reading-${key}`, label, options: options.map(option => [option, option || 'Not selected']), value: value || ''})}</div>`;
}

function confidenceLabel(fields, key) {
  const confidence = Number(fields.fieldConfidence?.[key]);
  return Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : 'not scored';
}
function fieldMarkup(fields, key, label, value) {
  if (!value) return '';
  return `<div class="identification-read-field"><b>${escapeHTML(label)}</b><span>${escapeHTML(value)}</span><small>${confidenceLabel(fields, key)}</small></div>`;
}

function attackSummary(attacks) {
  return (attacks || []).map(attack => {
    const name = (attack.names || []).join(' / ');
    const effect = (attack.effects || []).join(' / ');
    return [name, attack.damage, effect].filter(Boolean).join(' · ');
  }).filter(Boolean).join(' | ');
}

export function readingSummaryMarkup(fields, source, adequate, classification = {}) {
  const rows = [
    fieldMarkup(fields, 'name', 'Printed name', fields.name),
    fieldMarkup(fields, 'englishName', 'English name (suggested translation)', fields.englishName),
    fieldMarkup(fields, 'language', 'Language', fields.language),
    fieldMarkup(fields, 'setName', 'Printed set', fields.setName),
    fieldMarkup(fields, 'englishSetName', 'English set (unverified)', fields.englishSetName),
    fieldMarkup(fields, 'setCode', 'Printed set code', fields.setCode),
    fieldMarkup(fields, 'setSymbol', 'Set symbol', fields.setSymbol),
    fieldMarkup(fields, 'stamp', 'Stamp', fields.stamp),
    fieldMarkup(fields, 'copyrightText', 'Copyright text', fields.copyrightText),
    ...classificationFields.map(([key, label]) => classificationMarkup(key, label, classification[key])),
    fieldMarkup(fields, 'cardNumber', 'Collector number', fields.cardNumber),
    fieldMarkup(fields, 'dexNumber', 'Pokédex No.', fields.dexNumber),
    fieldMarkup(fields, 'level', 'Level', fields.level),
    fieldMarkup(fields, 'year', 'Year', fields.year),
    fieldMarkup(fields, 'hp', 'HP', fields.hp),
    fieldMarkup(fields, 'illustrator', 'Illustrator', fields.illustrator),
    fieldMarkup(fields, 'finish', 'Finish', fields.finish),
    fieldMarkup(fields, 'rarity', 'Rarity', fields.rarity),
    fieldMarkup(fields, 'attacks', 'Attacks and effects', attackSummary(fields.attacks))
  ].filter(Boolean).join('');
  const missing = Object.entries(fields.form || {}).filter(([, value]) => !value).map(([key]) => key);
  const missingNote = missing.length ? `<p>Fill or check: ${escapeHTML(missing.join(', '))}</p>` : '';
  const status = fields.identificationSummary || (adequate
    ? 'Review the evidence read from the photo.' : 'The photo did not provide enough clear identity details.');
  const uncertainty = (fields.uncertainFields || []).length
    ? `<p>Needs a check: ${escapeHTML(fields.uncertainFields.join(', '))}</p>` : '';
  return `<section class="identification-read-summary" aria-label="Details read from the photo">
    <p>${escapeHTML(status)}</p>${uncertainty}${missingNote}
    <div class="identification-read-grid">${rows || '<small>No identity details were read.</small>'}</div>
  </section>`;
}
