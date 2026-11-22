import {formatRarity} from '../utils/rarity.js';
import {identifyCardImage} from '../store/cards.js';
import {findSourceCatalogCard, findSourceCandidates, findEvidenceCard} from '../store/catalog.js';
import {escapeHTML} from '../utils/format.js';
import {invalidateCatalogSuggestions} from './search-catalog.js';
import {invalidateCardResolution} from './search-card-resolution.js';
import {cardLabelMetadata} from '../utils/label-metadata.js';
import {readingSummaryMarkup} from './card-identification-view.js';
import {intakeValues} from '../utils/intake-reading.js';
import {classificationFromReading} from '../utils/card-classification.js';
import {candidateConflicts, readingConflicts} from '../utils/card-identification-matching.js';
import {fillMissingCatalogValues, safeReadingErrorMessage, canRetryIdentification, standardLabelValues, catalogDifferences} from './card-identification-helpers.js';

let analysisVersion = 0;
let analysisBusy = false;
let appliedValues = null;
let candidateState = null;
let readingRequestId = '';
let fieldProvenance = {};
let identificationStatus = 'unknown';
let classification = {};
export function intakeClassification() { return {...classification}; }
export function identificationDialogMarkup() {
  return `<dialog id="identification-result" class="identification-dialog" aria-labelledby="identification-title">
    <header class="identification-dialog-header"><div><div class="page-eyebrow">GEMINI IDENTIFICATION</div><h2 id="identification-title">Review card reading</h2><p>Review the details read from the photo before adding it.</p></div>
      <button class="btn btn-ghost identification-close" type="button" data-close-identification aria-label="Close card result">×</button></header>
    <div id="identification-dialog-content" class="identification-dialog-content" aria-live="polite"></div>
  </dialog>`;
}

function updateButton() {
  const button = document.getElementById('identify-card');
  const file = document.getElementById('m-image-front')?.files?.[0];
  if (button) button.disabled = analysisBusy || !file;
}

function clearResult() {
  const dialog = document.getElementById('identification-result');
  if (dialog?.open) dialog.close();
  const content = document.getElementById('identification-dialog-content');
  if (content) content.innerHTML = '';
  const info = document.getElementById('identification-info');
  if (info) info.hidden = true;
}

export function resetCardIdentificationState() {
  analysisVersion += 1;
  candidateState = null;
  clearResult();
}

export function identificationProvenance() {
  return {identificationStatus, fieldProvenance: {...fieldProvenance}};
}

export function clearAppliedReading() {
  classification = {};
  fieldProvenance = {};
  readingRequestId = '';
  identificationStatus = 'unknown';
  appliedValues = null;
}

function invalidatePhotoIdentity() {
  classification = {};
  const prior = window.__intakeIdentification;
  resetCardIdentificationState();
  invalidateCardResolution();
  invalidateCatalogSuggestions();
  window.__intakeCatalogCard = null;
  window.__intakeIdentification = null;
  identificationStatus = prior ? 'unresolved' : 'unknown';
  window.__intakeIdentityReviewRequired = Boolean(prior);
  readingRequestId = '';
  fieldProvenance = Object.fromEntries(Object.entries(fieldProvenance).filter(([, source]) => source === 'user'));
  if (appliedValues) {
    for (const [key, value] of Object.entries(appliedValues)) {
      const input = document.getElementById(`m-${key}`);
      if (input && input.value === value) { input.value = ''; window.dispatchEvent(new Event('intake-values-updated')); }
    }
    appliedValues = null;
  }
  if (prior) {
    const status = document.getElementById('manual-status');
    if (status) status.textContent = 'The front photo changed. Review the existing card details or identify the new photo before saving.';
  }
}

function setResult(content) {
  const dialog = document.getElementById('identification-result');
  const panel = document.getElementById('identification-dialog-content');
  if (!dialog || !panel) return;
  panel.innerHTML = content;
  const info = document.getElementById('identification-info');
  if (info) info.hidden = false;
}

function fillGeminiValues(fields, requestId) {
  classification = classificationFromReading(fields);
  const values = intakeValues(fields, null);
  readingRequestId = requestId || '';
  identificationStatus = 'unresolved';
  window.__intakeIdentityReviewRequired = true;
  window.__intakeIdentification = {...fields, sourceLanguage: fields.language || 'unknown'};
  window.__intakeCatalogCard = null;
  window.__intakeCatalogGame = 'pokemon';
  const userFields = Object.fromEntries(Object.entries(fieldProvenance).filter(([, source]) => source === 'user'));
  fieldProvenance = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ? 'gemini' : 'unknown']));
  Object.assign(fieldProvenance, userFields);
  appliedValues = {};
  const labelValues = {...standardLabelValues(fields), series: fields.series,
    sourceLanguage: fields.language, artist: fields.illustrator};
  for (const [key, value] of Object.entries(labelValues)) {
    if (fieldProvenance[key] === 'user') continue;
    const input = document.getElementById(`m-${key}`);
    input.value = value || '';
    fieldProvenance[key] = input.value ? 'gemini' : 'unknown';
    appliedValues[key] = input.value;
  }
  for (const [key, value] of Object.entries(values)) {
    if (fieldProvenance[key] === 'user') continue;
    const input = document.getElementById(`m-${key}`);
    input.value = key === 'rarity' ? formatRarity(value) : value;
    window.dispatchEvent(new Event('intake-values-updated'));
    appliedValues[key] = input.value;
  }
  invalidateCatalogSuggestions();
  document.getElementById('manual-status').textContent = 'Gemini filled the available details. Checking the catalog; review all fields before saving.';
  return values;
}

async function applyReading(fields, version, requestId, values) {
  let catalogUnavailable = false;
  let source = await findSourceCatalogCard(fields).catch(() => { catalogUnavailable = true; return null; });
  let evidenceMatch = false;
  if (!source && !catalogUnavailable) {
    source = await findEvidenceCard(fields).catch(() => { catalogUnavailable = true; return null; });
    evidenceMatch = Boolean(source);
  }
  let candidates = [];
  if (!source && !catalogUnavailable) {
    candidates = await findSourceCandidates(fields).catch(() => { catalogUnavailable = true; return []; });
  }
  if (version !== analysisVersion) return null;
  const differences = catalogDifferences(values, source);
  if (source && userValuesConflict(values)) {
    if (!evidenceMatch) candidates.unshift(source);
    source = null;
  }
  if (source) fillMissingCatalogValues(fields, source, fieldProvenance, appliedValues);
  const sourceLanguage = fields.language || 'unknown';
  identificationStatus = source && !evidenceMatch ? 'matched' : 'unresolved';
  window.__intakeIdentityReviewRequired = !source || evidenceMatch;
  const selected = sourceLanguage === 'en' && source && !evidenceMatch
    ? {...source, sourceLanguage, sourceSetId: source.setId, sourceCardId: source.id, sourceFinish: ''}
    : {...values, ...Object.fromEntries(['setName', 'year', 'cardNumber', 'rarity'].map(key => [key, document.getElementById(`m-${key}`).value])), language: sourceLanguage, sourceLanguage, sourceSetId: source?.setId || '',
      sourceCardId: source?.id || '', setCode: fields.setCode || '', sourceFinish: '', catalogCardId: '', id: ''};
  const metadata = cardLabelMetadata(selected);
  window.__intakeCatalogCard = {...selected, ...metadata};
  const conflicts = readingConflicts(fields);
  const matchNote = source && differences.length ? `Catalog values applied: ${differences.join('; ')}. Review the card and variant.`
    : conflicts.length ? 'Conflicting anniversary stamp readings. Review the photo before selecting a set.'
      : source && evidenceMatch ? 'Possible catalog match based on card details. Missing fields were filled for review; verify the set, rarity, stamp and finish.'
        : source ? 'Printed-language catalog record found. Check stamp and finish; the variant is not verified.'
        : catalogUnavailable ? 'Catalog unavailable; review the Gemini values before saving.'
          : 'No verified printed-language record found. Review the Gemini values before saving.';
  const englishNote = sourceLanguage !== 'en'
    ? ' Card number is the printed number; English name is a translation to review.' : '';
  document.getElementById('manual-status').textContent = `${matchNote}${englishNote}`;
  logIdentificationStage('browser', {match: source ? evidenceMatch ? 'evidence_review' : 'matched' : catalogUnavailable ? 'catalog_unavailable' : 'unresolved',
    candidates: candidates.map(card => card.id), provenance: fieldProvenance, conflicts: [...conflicts, ...differences]});
  return {source, candidates, matchNote, englishNote};
}

export function logIdentificationStage(stage, details) {
  if (!readingRequestId) return;
  fetch('/api/cards/identification-log', {method: 'POST', credentials: 'same-origin', keepalive: true,
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestId: readingRequestId, stage, ...details})}).catch(() => {});
}

function userValuesConflict(values) {
  return ['name', 'setName', 'year', 'cardNumber'].some(key => fieldProvenance[key] === 'user'
    && document.getElementById(`m-${key}`).value.trim().toLowerCase() !== String(values[key] || '').trim().toLowerCase());
}

function candidateMarkup(candidates) {
  if (!candidates.length) return '';
  const items = candidates.map((card, index) => `<li><button type="button" data-identification-candidate="${index}">${escapeHTML([card.name, card.setName || 'Set unknown', card.cardNumber, card.language].filter(Boolean).join(' · '))}</button></li>`).join('');
  return `<section><p>Possible printed-language records; names may differ. Compare the name, set, stamp, and number before using them:</p><ul>${items}</ul></section>`;
}

function selectReadingCandidate(index) {
  const state = candidateState;
  const card = state?.candidates[index];
  if (!card || state.version !== analysisVersion) return;
  const conflicts = candidateConflicts(state.fields, card);
  if (conflicts.length) {
    document.getElementById('manual-status').textContent = `Candidate conflicts with the photo reading: ${conflicts.join(', ')}. Review the image and enter the details manually.`;
    document.getElementById('identification-result')?.close();
    return;
  }
  const values = intakeValues(state.fields, card);
  if (userValuesConflict(values)) {
    document.getElementById('manual-status').textContent = 'Edited details differ from this candidate. Review and correct the fields before selecting it.';
    document.getElementById('identification-result')?.close();
    return;
  }
  const language = state.fields.language || 'unknown';
  const selected = {...card, id: language === 'en' ? card.id : '', sourceLanguage: language,
    sourceSetId: card.setId, sourceCardId: card.id, catalogCardId: language === 'en' ? card.id : '', sourceFinish: ''};
  window.__intakeCatalogCard = {...selected, ...cardLabelMetadata(selected)};
  identificationStatus = 'user_selected';
  window.__intakeIdentityReviewRequired = false;
  for (const key of ['name', 'setName', 'year', 'cardNumber', 'rarity']) {
    const input = document.getElementById(`m-${key}`);
    if (appliedValues && !Object.hasOwn(appliedValues, key)) continue;
    const value = key === 'rarity' ? formatRarity(values[key]) : values[key];
    input.value = value;
    window.dispatchEvent(new Event('intake-values-updated'));
    if (appliedValues) appliedValues[key] = value;
    fieldProvenance[key] = key === 'cardNumber' || key === 'name' && language !== 'en' ? 'gemini' : 'catalog';
  }
  logIdentificationStage('selection', {selected: card.id, values, provenance: fieldProvenance});
  document.getElementById('manual-status').textContent = 'Candidate selected for review. Verify the printed number, stamp, set, and finish before saving.';
  document.getElementById('identification-result')?.close();
}

function showError(message) {
  document.getElementById('manual-status').textContent = message;
}

async function analyzeFront() {
  const button = document.getElementById('identify-card');
  const file = document.getElementById('m-image-front')?.files?.[0];
  if (!button || !file || analysisBusy) return;
  clearResult();
  const version = ++analysisVersion;
  analysisBusy = true;
  button.disabled = true;
  button.textContent = 'Identifying card…';
  try {
    let result;
    try { result = await identifyCardImage(file); }
    catch (error) {
      if (version === analysisVersion) showError(safeReadingErrorMessage(error), canRetryIdentification(error));
      return;
    }
    if (version !== analysisVersion) return;
    if (!result.fields || !result.readingAdequate) {
      showError('Gemini could not read enough identity details. Try a clearer front photo or enter the details manually.', true);
      return;
    }
    const values = fillGeminiValues(result.fields, result.requestId);
    const resolution = await applyReading(result.fields, version, result.requestId, values);
    if (resolution && version === analysisVersion) candidateState = {fields: result.fields, candidates: resolution.candidates, version};
    if (resolution && version === analysisVersion) setResult(`${readingSummaryMarkup(result.fields, result.source, true, classification)}<p class="identification-match-note">${escapeHTML(resolution.matchNote + resolution.englishNote)} Review all details before saving.</p>${candidateMarkup(resolution.candidates)}`);
  } finally {
    analysisBusy = false;
    button.textContent = 'Identify card';
    updateButton();
  }
}

document.addEventListener('input', event => {
  if (event.target.matches('#identification-result [data-classification]')) classification[event.target.dataset.classification] = event.target.value;
  const key = event.target.id?.replace(/^m-/, '');
  if (['name', 'setName', 'year', 'cardNumber', 'rarity', 'cardTypeLabel', 'series', 'sourceLanguage', 'languageLabel', 'artist'].includes(key)) {
    if (analysisBusy) analysisVersion += 1;
    candidateState = null;
    fieldProvenance[key] = 'user';
    if (['name', 'setName', 'year', 'cardNumber'].includes(key) && identificationStatus !== 'unknown') {
      identificationStatus = 'unresolved';
      window.__intakeIdentityReviewRequired = true;
    }
  }
  if (appliedValues && Object.hasOwn(appliedValues, key)) delete appliedValues[key];
});

document.addEventListener('change', event => {
  if (event.target.matches('#identification-result [data-classification]')) classification[event.target.dataset.classification] = event.target.value;
  if (!event.target.matches('[data-upload-side="front"]')) return;
  invalidatePhotoIdentity();
  updateButton();
});

window.addEventListener('intake-front-image-cleared', () => {
  invalidatePhotoIdentity();
  updateButton();
});

document.addEventListener('click', event => {
  const candidate = event.target.closest('[data-identification-candidate]');
  if (candidate) { selectReadingCandidate(Number(candidate.dataset.identificationCandidate)); return; }
  if (event.target.closest('#identification-info')) { document.getElementById('identification-result')?.showModal(); return; }
  if (event.target.closest('#identify-card')) { analyzeFront(); return; }
  if (event.target.closest('[data-retry-identification]')) { clearResult(); analyzeFront(); return; }
  if (event.target.closest('[data-close-identification]')) document.getElementById('identification-result')?.close();
  if (event.target.id === 'identification-result') event.target.close();
});
