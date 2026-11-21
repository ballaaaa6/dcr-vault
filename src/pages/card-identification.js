import {formatRarity} from '../utils/rarity.js';
import {identifyCardImage} from '../store/cards.js';
import {findSourceCatalogCard} from '../store/catalog.js';
import {escapeHTML} from '../utils/format.js';
import {hideAllCatalogSuggestions} from './search-catalog.js';
import {cardLabelMetadata} from '../utils/label-metadata.js';
import {readingSummaryMarkup} from './card-identification-view.js';
import {hasNonLatinScript} from '../utils/language.js';

let analysisVersion = 0;
let analysisBusy = false;

export function identificationDialogMarkup() {
  return `<dialog id="identification-result" class="identification-dialog" aria-labelledby="identification-title">
    <header class="identification-dialog-header"><div><div class="page-eyebrow">GEMINI IDENTIFICATION</div><h2 id="identification-title">Card identified</h2><p>Review the details read from the photo before adding it.</p></div>
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
  clearResult();
}

function showDialog(content) {
  const dialog = document.getElementById('identification-result');
  const panel = document.getElementById('identification-dialog-content');
  if (!dialog || !panel) return;
  panel.innerHTML = content;
  if (!dialog.open) dialog.showModal();
}

function latinText(value) {
  return value && !hasNonLatinScript(value) ? value : '';
}

async function applyReading(fields, version) {
  const source = await findSourceCatalogCard(fields).catch(() => null);
  if (version !== analysisVersion) return null;
  const sourceLanguage = fields.language || 'unknown';
  const english = sourceLanguage === 'en' ? source : null;
  const selected = english ? {...english, sourceLanguage, sourceSetId: source.setId, sourceCardId: source.id,
    sourceFinish: fields.finish || ''} : {name: fields.englishName || '', setName: latinText(source?.setName),
    year: source?.year || '', cardNumber: fields.cardNumber || '', rarity: source?.rarity || '',
    language: sourceLanguage, sourceLanguage, sourceSetId: source?.setId || '', sourceCardId: source?.id || '',
    setCode: fields.setCode || '', sourceFinish: fields.finish || '', catalogCardId: '', id: ''};
  const metadata = cardLabelMetadata(selected);
  window.__intakeCatalogCard = {...selected, ...metadata};
  window.__intakeIdentification = {...fields, sourceLanguage};
  window.__intakeCatalogGame = 'pokemon';
  document.getElementById('m-name').value = english?.name || fields.englishName || (sourceLanguage === 'en' ? fields.name : '') || '';
  document.getElementById('m-setName').value = english?.setName || latinText(source?.setName) || '';
  document.getElementById('m-year').value = source?.year || '';
  document.getElementById('m-cardNumber').value = fields.cardNumber || '';
  document.getElementById('m-rarity').value = formatRarity(source?.rarity || fields.rarity);
  hideAllCatalogSuggestions();
  const matchNote = source ? 'Printed-language catalog record found. Check stamp and finish; the variant is not verified.'
    : 'No verified printed-language record found. Check the set code and collector number or use a clearer photo.';
  const englishNote = sourceLanguage !== 'en'
    ? ' Card number is the printed number; English name is a translation to review. English counterpart is not verified.' : '';
  const labelNote = !metadata.labelMetadataReady ? ' A verified label profile is required before printing.' : '';
  document.getElementById('manual-status').textContent = `${matchNote}${englishNote}${labelNote}`;
  document.getElementById('m-grade').focus();
  return {source, matchNote, englishNote};
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
      showError('Gemini could not read the card name clearly enough. Try a clearer front photo or enter the details manually.', true);
      return;
    }
    const resolution = await applyReading(result.fields, version);
    if (resolution && version === analysisVersion) showDialog(`${readingSummaryMarkup(result.fields, result.source, true)}<p class="identification-match-note">${escapeHTML(resolution.matchNote + resolution.englishNote)} Review all details before saving.</p>`);
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

document.addEventListener('change', event => {
  if (!event.target.matches('[data-upload-side="front"]')) return;
  analysisVersion += 1;
  clearResult();
  updateButton();
});

window.addEventListener('intake-front-image-cleared', () => {
  analysisVersion += 1;
  clearResult();
  updateButton();
});

document.addEventListener('click', event => {
  if (event.target.closest('#identify-card')) { analyzeFront(); return; }
  if (event.target.closest('[data-retry-identification]')) { clearResult(); analyzeFront(); return; }
  if (event.target.closest('[data-close-identification]')) document.getElementById('identification-result')?.close();
  if (event.target.id === 'identification-result') event.target.close();
});
