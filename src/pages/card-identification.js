import {formatRarity} from '../utils/rarity.js';
import {identifyCardImage} from '../store/cards.js';
import {findSourceCatalogCard, findSourceCandidates} from '../store/catalog.js';
import {escapeHTML} from '../utils/format.js';
import {invalidateCatalogSuggestions} from './search-catalog.js';
import {invalidateCardResolution} from './search-card-resolution.js';
import {cardLabelMetadata} from '../utils/label-metadata.js';
import {readingSummaryMarkup} from './card-identification-view.js';
import {intakeValues} from '../utils/intake-reading.js';
import {readingConflicts} from '../utils/card-identification-matching.js';

let analysisVersion = 0;
let analysisBusy = false;
let appliedValues = null;
let candidateState = null;
let readingRequestId = '';
let fieldProvenance = {};
let identificationStatus = 'unknown';

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
  fieldProvenance = {};
  readingRequestId = '';
  identificationStatus = 'unknown';
  appliedValues = null;
}

function invalidatePhotoIdentity() {
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
      if (input && input.value === value) input.value = '';
    }
    appliedValues = null;
  }
  if (prior) {
    const status = document.getElementById('manual-status');
    if (status) status.textContent = 'The front photo changed. Review the existing card details or identify the new photo before saving.';
  }
}

function showDialog(content) {
  const dialog = document.getElementById('identification-result');
  const panel = document.getElementById('identification-dialog-content');
  if (!dialog || !panel) return;
  panel.innerHTML = content;
  if (!dialog.open) dialog.showModal();
}

async function applyReading(fields, version, requestId) {
  let catalogUnavailable = false;
  let source = await findSourceCatalogCard(fields).catch(() => { catalogUnavailable = true; return null; });
  let candidates = [];
  if (!source && !catalogUnavailable) {
    candidates = await findSourceCandidates(fields).catch(() => { catalogUnavailable = true; return []; });
  }
  if (version !== analysisVersion) return null;
  const sourceLanguage = fields.language || 'unknown';
  let values = intakeValues(fields, source);
  if (source && userValuesConflict(values)) {
    candidates.unshift(source);
    source = null;
    values = intakeValues(fields, null);
  }
  const english = sourceLanguage === 'en' ? source : null;
  readingRequestId = requestId || '';
  identificationStatus = source ? 'matched' : 'unresolved';
  window.__intakeIdentityReviewRequired = !source;
  const userFields = Object.fromEntries(Object.entries(fieldProvenance).filter(([, value]) => value === 'user'));
  fieldProvenance = {name: sourceLanguage === 'en' && source ? 'catalog' : 'gemini',
    setName: source ? 'catalog' : 'unknown', year: source ? 'catalog' : 'unknown',
    cardNumber: 'gemini', rarity: source ? 'catalog' : 'unknown', ...userFields};
  const selected = english ? {...english, sourceLanguage, sourceSetId: source.setId, sourceCardId: source.id,
    sourceFinish: ''} : {...values,
    language: sourceLanguage, sourceLanguage, sourceSetId: source?.setId || '', sourceCardId: source?.id || '',
    setCode: fields.setCode || '', sourceFinish: '', catalogCardId: '', id: ''};
  const metadata = cardLabelMetadata(selected);
  window.__intakeCatalogCard = {...selected, ...metadata};
  window.__intakeIdentification = {...fields, sourceLanguage};
  window.__intakeCatalogGame = 'pokemon';
  appliedValues = {};
  for (const key of ['name', 'setName', 'year', 'cardNumber', 'rarity']) {
    if (fieldProvenance[key] === 'user') continue;
    const input = document.getElementById(`m-${key}`);
    input.value = key === 'rarity' ? formatRarity(values[key]) : values[key];
    appliedValues[key] = input.value;
  }
  invalidateCatalogSuggestions();
  const conflicts = readingConflicts(fields);
  const matchNote = Object.keys(userFields).length ? 'Your edited fields were kept. Check them against the photo and any candidate.'
    : conflicts.length ? 'Conflicting anniversary stamp readings. Review the image before selecting a set.'
    : source ? 'Printed-language catalog record found. Check stamp and finish; the variant is not verified.'
    : catalogUnavailable ? 'Catalog unavailable; photo readings are unverified. Try again and review the details.'
      : 'No verified printed-language record found. Set, year and rarity require review; photo readings are shown above.';
  const englishNote = sourceLanguage !== 'en'
    ? ' Card number is the printed number; English name is a translation to review. English counterpart is not verified.' : '';
  const labelNote = !metadata.labelMetadataReady ? ' A verified label profile is required before printing.' : '';
  document.getElementById('manual-status').textContent = `${matchNote}${englishNote}${labelNote}`;
  document.getElementById('m-grade').focus();
  logIdentificationStage('browser', {match: source ? 'matched' : catalogUnavailable ? 'catalog_unavailable' : 'unresolved',
    candidates: candidates.map(card => card.id),
    values: Object.fromEntries(['name', 'setName', 'year', 'cardNumber', 'rarity'].map(key => [key, document.getElementById(`m-${key}`).value])),
    provenance: fieldProvenance, conflicts});
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
  const values = intakeValues(state.fields, card);
  if (userValuesConflict(values)) {
    document.getElementById('manual-status').textContent = 'Edited details differ from this candidate. Review and correct the fields before selecting it.';
    clearResult();
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
    if (appliedValues) appliedValues[key] = value;
    fieldProvenance[key] = key === 'cardNumber' || key === 'name' && language !== 'en' ? 'gemini' : 'catalog';
  }
  logIdentificationStage('selection', {selected: card.id, values, provenance: fieldProvenance});
  document.getElementById('manual-status').textContent = 'Candidate selected for review. Verify the printed number, stamp, set, and finish before saving; a verified label profile may still be required.';
  clearResult();
}

function showError(message, retryable) {
  const retryButton = retryable
    ? '<div class="identification-error-actions"><button class="btn btn-primary" data-retry-identification type="button">Try again</button></div>' : '';
  showDialog(`<p class="catalog-empty">${escapeHTML(message)}</p>${retryButton}`);
}

async function analyzeFront() {
  const button = document.getElementById('identify-card');
  const file = document.getElementById('m-image-front')?.files?.[0];
  if (!button || !file) return;
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
    const resolution = await applyReading(result.fields, version, result.requestId);
    if (resolution && version === analysisVersion) candidateState = {fields: result.fields, candidates: resolution.candidates, version};
    if (resolution && version === analysisVersion) showDialog(`${readingSummaryMarkup(result.fields, result.source, true)}<p class="identification-match-note">${escapeHTML(resolution.matchNote + resolution.englishNote)} Review all details before saving.</p>${candidateMarkup(resolution.candidates)}`);
  } finally {
    analysisBusy = false;
    button.textContent = 'Identify card';
    updateButton();
  }
}

function safeReadingErrorMessage(error) {
  if (/not configured/i.test(error?.message || '')) return 'Card reading is not configured for this deployment.';
  if (error?.code === 'gemini_quota' || error?.status === 429) return 'Gemini request quota was reached. Try again later.';
  if (error?.code === 'gemini_configuration') return 'Gemini API settings need to be fixed by the site administrator.';
  if (error?.status === 503) return 'Gemini card reading is temporarily unavailable. Try again in a moment.';
  if (error?.status === 422) return 'Gemini could not identify this card. Try a clearer front image.';
  return error?.message || 'Card reading could not be completed. Try again in a moment.';
}

function canRetryIdentification(error) {
  return error?.status === 429 || error?.status >= 500 || !error?.status;
}

document.addEventListener('input', event => {
  const key = event.target.id?.replace(/^m-/, '');
  if (['name', 'setName', 'year', 'cardNumber', 'rarity'].includes(key)) {
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
  if (event.target.closest('#identify-card')) { analyzeFront(); return; }
  if (event.target.closest('[data-retry-identification]')) { clearResult(); analyzeFront(); return; }
  if (event.target.closest('[data-close-identification]')) document.getElementById('identification-result')?.close();
  if (event.target.id === 'identification-result') event.target.close();
});
