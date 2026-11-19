import {identifyCardImage} from '../store/cards.js';
import {findImageCandidates} from '../store/catalog.js';
import {escapeHTML} from '../utils/format.js';
import {hideAllCatalogSuggestions} from './search-catalog.js';

let candidateCards = [];
let extractedFields = {};
let analysisVersion = 0;
let analysisBusy = false;

export function identificationDialogMarkup() {
  return `<dialog id="identification-result" class="identification-dialog" aria-labelledby="identification-title">
    <header class="identification-dialog-header"><div><div class="page-eyebrow">CARD MATCH</div><h2 id="identification-title">Choose the matching card</h2><p>Card names and set names are shown in English for label printing.</p></div>
      <button class="btn btn-ghost identification-close" type="button" data-close-identification aria-label="Close card matches">×</button></header>
    <div id="identification-dialog-content" class="identification-dialog-content" aria-live="polite"></div>
    <img id="identification-hover-preview" class="identification-hover-preview" alt="" hidden>
  </dialog>`;
}

function updateButton() {
  const button = document.getElementById('identify-card');
  const file = document.getElementById('m-image-front')?.files?.[0];
  if (button) button.disabled = analysisBusy || !file;
}

function clearResult() {
  candidateCards = [];
  extractedFields = {};
  const dialog = document.getElementById('identification-result');
  if (dialog?.open) dialog.close();
  const content = document.getElementById('identification-dialog-content');
  if (content) content.innerHTML = '';
  hideHoverPreview();
}

export function resetCardIdentificationState() {
  analysisVersion += 1;
  clearResult();
}

function candidateMarkup(card, index) {
  const image = card.previewImage || card.imageUrl;
  const imageMarkup = image ? `<img class="identification-option-image" src="${escapeHTML(image)}" alt="" loading="eager">` : '';
  const details = [card.setName, card.year, card.cardNumber && `#${card.cardNumber}`, card.rarity].filter(Boolean);
  const previewAttrs = image ? `data-preview-src="${escapeHTML(image)}" data-preview-alt="${escapeHTML(card.name)}" data-has-image="true"` : '';
  return `<button class="identification-option" data-image-candidate="${index}" ${previewAttrs} type="button">${imageMarkup}
    <span class="identification-option-copy"><strong>${escapeHTML(card.name)}</strong><span>${escapeHTML(details.join(' · '))}</span></span></button>`;
}

function showCandidates(fields, cards) {
  candidateCards = cards;
  extractedFields = fields;
  const options = cards.length ? cards.map(candidateMarkup).join('') : '<p class="catalog-empty">No English catalog match was found. Enter the English card name and set manually.</p>';
  showDialog(`<p class="identification-match-note">Select a card to fill the English catalog details in Block 2. This will not save the card.</p><div class="identification-options">${options}</div>`);
}

function showDialog(content) {
  const dialog = document.getElementById('identification-result');
  const panel = document.getElementById('identification-dialog-content');
  if (!dialog || !panel) return;
  hideHoverPreview();
  panel.innerHTML = content;
  if (!dialog.open) dialog.showModal();
}

function chooseCandidate(index) {
  const card = candidateCards[index];
  if (!card) return;
  document.getElementById('m-name').value = card.name;
  document.getElementById('m-setName').value = card.setName;
  document.getElementById('m-year').value = card.year;
  const observedNumber = String(extractedFields.cardNumber || '').trim();
  const localNumber = value => value.replace(/^#/, '').split('/')[0].replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
  document.getElementById('m-cardNumber').value = observedNumber && localNumber(observedNumber) === localNumber(card.cardNumber)
    ? observedNumber : card.cardNumber;
  document.getElementById('m-rarity').value = card.rarity;
  window.__intakeCatalogGame = 'pokemon';
  hideAllCatalogSuggestions();
  const rarityNote = card.rarity ? '' : ' The catalog has no rarity for this card; leave it blank or choose a value from the dropdown.';
  document.getElementById('manual-status').textContent = `English catalog details selected. Check the details, then enter Cert and Grade.${rarityNote}`;
  document.getElementById('identification-result').close();
  hideHoverPreview();
  document.getElementById('m-grade').focus();
}

function showError(message) {
  showDialog(`<p class="catalog-empty">${escapeHTML(message)}</p>`);
}

async function analyzeFront() {
  const button = document.getElementById('identify-card');
  const file = document.getElementById('m-image-front')?.files?.[0];
  if (!button || !file) return;
  const version = ++analysisVersion;
  analysisBusy = true;
  button.disabled = true;
  button.textContent = 'Reading card details…';
  try {
    const result = await identifyCardImage(file);
    const candidates = await findImageCandidates(result.fields);
    if (version === analysisVersion) showCandidates(result.fields, candidates);
  } catch (error) {
    if (version === analysisVersion) showError(safeErrorMessage(error));
  } finally {
    analysisBusy = false;
    button.textContent = 'Read card details';
    updateButton();
  }
}

function safeErrorMessage(error) {
  const message = error?.message || '';
  return /gemma/i.test(message) ? 'Card reading is unavailable. Try another front photo or enter the details manually.'
    : message || 'Card reading is unavailable. Try another front photo or enter the details manually.';
}

function hideHoverPreview() {
  const preview = document.getElementById('identification-hover-preview');
  if (preview) { preview.hidden = true; preview.removeAttribute('src'); }
}

function showHoverPreview(option, event) {
  const preview = document.getElementById('identification-hover-preview');
  if (!preview || !option.dataset.previewSrc || event.pointerType === 'touch') return;
  preview.src = option.dataset.previewSrc;
  preview.alt = `${option.dataset.previewAlt} card preview`;
  const bounds = option.getBoundingClientRect();
  const width = 220;
  const height = 304;
  const left = bounds.right + width + 14 < window.innerWidth ? bounds.right + 14 : bounds.left - width - 14;
  preview.style.left = `${Math.max(12, left)}px`;
  preview.style.top = `${Math.max(12, Math.min(window.innerHeight - height - 12, bounds.top))}px`;
  preview.hidden = false;
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
  if (event.target.closest('[data-close-identification]')) { document.getElementById('identification-result')?.close(); return; }
  if (event.target.id === 'identification-result') { event.target.close(); return; }
  const candidate = event.target.closest('[data-image-candidate]');
  if (candidate) chooseCandidate(Number(candidate.dataset.imageCandidate));
});

document.addEventListener('pointerover', event => {
  const option = event.target.closest('[data-preview-src]');
  if (option && !option.contains(event.relatedTarget)) showHoverPreview(option, event);
});

document.addEventListener('pointerout', event => {
  const option = event.target.closest('[data-preview-src]');
  if (option && !option.contains(event.relatedTarget)) hideHoverPreview();
});

document.addEventListener('scroll', hideHoverPreview, true);

document.addEventListener('error', event => {
  if (event.target.matches('.identification-option-image')) {
    const option = event.target.closest('[data-image-candidate]');
    option?.removeAttribute('data-preview-src');
    option?.removeAttribute('data-has-image');
    event.target.remove();
  }
  if (event.target.id === 'identification-hover-preview') hideHoverPreview();
}, true);
