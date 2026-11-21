import {escapeHTML} from '../utils/format.js';

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

function readingValue(value) {
  if (!Array.isArray(value)) return String(value ?? '');
  return value.map(item => {
    if (typeof item !== 'object' || !item) return String(item ?? '');
    const names = Array.isArray(item.names) ? item.names : [item.name];
    const effects = Array.isArray(item.effects) ? item.effects : [item.effect];
    return [[...names, ...effects].filter(Boolean).join(' / '), item.damage, item.cost?.join(', ')].filter(Boolean).join(' · ');
  }).filter(Boolean).join(' | ');
}

function readerName(source) {
  if (source === 'gemini_oracle_ocr') return 'Gemini + DCR OCR';
  return source === 'oracle_ocr' ? 'DCR OCR' : 'Gemini';
}

export function readingSummaryMarkup(fields, source, adequate) {
  const rows = [
    fieldMarkup(fields, 'name', 'Printed name', fields.name),
    fieldMarkup(fields, 'englishName', 'English name', fields.englishName),
    fieldMarkup(fields, 'language', 'Language', fields.language),
    fieldMarkup(fields, 'setName', 'Printed set', fields.setName),
    fieldMarkup(fields, 'cardNumber', 'Collector number', fields.cardNumber),
    fieldMarkup(fields, 'dexNumber', 'Pokédex No.', fields.dexNumber),
    fieldMarkup(fields, 'level', 'Level', fields.level),
    fieldMarkup(fields, 'year', 'Year', fields.year),
    fieldMarkup(fields, 'hp', 'HP', fields.hp),
    fieldMarkup(fields, 'illustrator', 'Illustrator', fields.illustrator),
    fieldMarkup(fields, 'finish', 'Finish', fields.finish),
    fieldMarkup(fields, 'attacks', 'Attacks and effects', attackSummary(fields.attacks))
  ].filter(Boolean).join('');
  const status = adequate
    ? 'These are the details read from the photo. Catalog options are checked against these values.'
    : 'The photo did not provide enough distinct identity details. No broad card guesses are shown.';
  const disagreements = (fields.disagreements || []).map(item => `<li>${escapeHTML(item.field)}: Gemini “${escapeHTML(readingValue(item.primary))}” · DCR OCR “${escapeHTML(readingValue(item.fallback))}”</li>`).join('');
  return `<section class="identification-read-summary" aria-label="Details read from the photo">
    <div class="identification-read-heading"><b>Read from photo</b><small>${escapeHTML(readerName(source))}</small></div>
    <p>${escapeHTML(status)}</p>${disagreements ? `<ul class="identification-read-disagreements">${disagreements}</ul>` : ''}
    <div class="identification-read-grid">${rows || '<small>No identity details were read.</small>'}</div>
  </section>`;
}

export function variantSummary(card) {
  const variants = card.metadata?.variants || [];
  const names = variants.map(variant => [variant.type, variant.subtype].filter(Boolean).join(' ')).filter(Boolean);
  return [...new Set(names)].join(' / ');
}
