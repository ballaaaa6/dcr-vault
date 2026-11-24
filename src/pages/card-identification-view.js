import {escapeHTML} from '../utils/format.js';
import {classificationFields, classificationChoices} from '../utils/card-classification.js';
import {dropdown} from '../components/dropdown.js';


function classificationMarkup(key, label, value) {
  const options = ['', ...classificationChoices[key]];
  if (value && !options.includes(value)) options.push(value);
  return `<div class="identification-read-field identification-classification" data-classification-row="${key}"><b>${escapeHTML(label)}</b>${dropdown({id: `reading-${key}`, label, options: options.map(option => [option, option || 'Not selected']), value: value || ''})}</div>`;
}

function fieldMarkup(label, value) {
  if (!value) return '';
  return `<div class="identification-read-field"><b>${escapeHTML(label)}</b><span>${escapeHTML(value)}</span></div>`;
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
    fieldMarkup('Printed name', fields.name),
    fieldMarkup('English name (suggested translation)', fields.englishName),
    fieldMarkup('Language', fields.language),
    fieldMarkup('Printed set', fields.setName),
    fieldMarkup('English set (unverified)', fields.englishSetName),
    fieldMarkup('Printed set code', fields.setCode),
    fieldMarkup('Set symbol', fields.setSymbol),
    fieldMarkup('Stamp', fields.stamp),
    fieldMarkup('Copyright text', fields.copyrightText),
    ...classificationFields.map(([key, label]) => classificationMarkup(key, label, classification[key])),
    fieldMarkup('Collector number', fields.cardNumber),
    fieldMarkup('Pokédex No.', fields.dexNumber),
    fieldMarkup('Level', fields.level),
    fieldMarkup('Year', fields.year),
    fieldMarkup('HP', fields.hp),
    fieldMarkup('Illustrator', fields.illustrator),
    fieldMarkup('Finish', fields.finish),
    fieldMarkup('Rarity', fields.rarity),
    fieldMarkup('Attacks and effects', attackSummary(fields.attacks))
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
