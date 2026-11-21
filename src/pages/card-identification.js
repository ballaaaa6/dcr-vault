import {identifyCardImage} from '../store/cards.js';
import {findExactCatalogCard} from '../store/catalog.js';
import {escapeHTML} from '../utils/format.js';
import {hideAllCatalogSuggestions} from './search-catalog.js';
import {cardLabelMetadata} from '../utils/label-metadata.js';
import {readingSummaryMarkup} from './card-identification-view.js';

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

function formName(fields) {
  return fields.englishName || (fields.language === 'en' ? fields.name : '');
}

function formSet(fields) {
  return fields.englishSetName || (fields.language === 'en' ? fields.setName : '');
}

function formNumber(fields) {
  return fields.englishCardNumber || (fields.language === 'en' ? fields.cardNumber : '');
}

async function exactCatalogCard(fields) {
  const name = formName(fields);
  const setName = formSet(fields);
  if (!name || !setName) return null;
  try { return await findExactCatalogCard({name, setName, year: fields.year, cardNumber: formNumber(fields)}); }
  catch { return null; }
}

async function applyReading(fields) {
  const card = await exactCatalogCard(fields);
  const sourceLanguage = fields.language || 'unknown';
  const selected = card
    ? {...card, sourceLanguage, sourceSetId: sourceLanguage === 'en' ? card.setId : '', sourceCardId: '', sourceFinish: fields.finish || ''}
    : {name: formName(fields), setName: formSet(fields), year: fields.year || '', cardNumber: formNumber(fields),
      rarity: fields.rarity || '', language: sourceLanguage, sourceLanguage, sourceSetId: '', setCode: fields.setCode || '', catalogCardId: '', id: ''};
  const metadata = cardLabelMetadata(selected);
  window.__intakeCatalogCard = {...selected, ...metadata};
  window.__intakeIdentification = {...fields, sourceLanguage};
  window.__intakeCatalogGame = 'pokemon';
  document.getElementById('m-name').value = formName(fields);
  document.getElementById('m-setName').value = formSet(fields);
  document.getElementById('m-year').value = fields.year || card?.year || '';
  document.getElementById('m-cardNumber').value = formNumber(fields) || card?.cardNumber || '';
  document.getElementById('m-rarity').value = fields.rarity || card?.rarity || '';
  hideAllCatalogSuggestions();
  const catalogNote = card ? ' An exact catalog record was linked.' : ' No exact catalog record was linked; verify any missing English label details.';
  const uncertainNote = fields.uncertainFields?.length ? ` Check: ${fields.uncertainFields.join(', ')}.` : '';
  const labelNote = !metadata.labelMetadataReady
    ? ' A verified label profile for this printed language/set is required before label printing.'
    : !metadata.yearSeries ? ' Approved set year/series data is missing for label printing.' : '';
  const identityMessage = fields.identityStatus === 'identified' ? 'Gemini identified this card.' : 'Gemini suggested this card; verify the uncertain fields.';
  document.getElementById('manual-status').textContent = `${identityMessage} Review the English details.${catalogNote}${uncertainNote}${labelNote}`;
  document.getElementById('m-grade').focus();
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
    await applyReading(result.fields);
    if (version === analysisVersion) showDialog(`${readingSummaryMarkup(result.fields, result.source, true)}<p class="identification-match-note">The form has been filled from Gemini’s answer. Confirm the details before saving.</p>`);
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
