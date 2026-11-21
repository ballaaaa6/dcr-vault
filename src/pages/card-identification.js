import {identifyCardImage} from '../store/cards.js';
import {findImageCandidates, findImageReviewCandidates} from '../store/catalog.js';
import {escapeHTML} from '../utils/format.js';
import {hideAllCatalogSuggestions} from './search-catalog.js';
import {cardLabelMetadata} from '../utils/label-metadata.js';
import {readingSummaryMarkup, variantSummary} from './card-identification-view.js';

let candidateCards = [];
let analysisVersion = 0;
let analysisBusy = false;

export function identificationDialogMarkup() {
  return `<dialog id="identification-result" class="identification-dialog" aria-labelledby="identification-title">
    <header class="identification-dialog-header"><div><div class="page-eyebrow">CARD MATCH</div><h2 id="identification-title">Choose the matching card</h2><p>Card details are shown in the printed language; label values use English.</p></div>
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
  const sourceCard = card.sourceCard || card;
  const image = sourceCard.imageUrl || '';
  const imageMarkup = image ? `<img class="identification-option-image" src="${escapeHTML(image)}" alt="" loading="eager">` : '';
  const labelMetadata = cardLabelMetadata({...card, sourceLanguage: sourceCard.language, sourceSetId: sourceCard.setId});
  const sourceNumber = card.sourceCardNumber || sourceCard.cardNumber;
  const sourceDetails = [sourceCard.setName, sourceCard.year, sourceNumber && `#${sourceNumber}`, sourceCard.rarity,
    variantSummary(sourceCard)].filter(Boolean);
  const labelDetails = [labelMetadata.setName || card.setName, card.year, card.cardNumber && `#${card.cardNumber}`,
    card.rarity, variantSummary(card)].filter(Boolean);
  const attacks = (sourceCard.metadata?.attacks || []).map(attack => {
    const name = attack.names?.find(Boolean) || '';
    return [name, attack.damage].filter(Boolean).join(' ');
  }).filter(Boolean);
  const sourcePrint = `${String(sourceCard.language || 'en').toUpperCase()} print`;
  const evidence = [sourcePrint, sourceCard.metadata?.hp && `${sourceCard.metadata.hp} HP`, sourceCard.metadata?.illustrator && `Illus. ${sourceCard.metadata.illustrator}`,
    attacks.length && attacks.join(' · ')].filter(Boolean);
  const matchedOn = card.matchEvidence?.length ? `<small>Matched on: ${escapeHTML(card.matchEvidence.join(' · '))}</small>` : '';
  const fallback = sourceCard.imageUrlFallback || '';
  const previewAttrs = image ? `data-preview-src="${escapeHTML(image)}" data-preview-alt="${escapeHTML(sourceCard.name)}" data-has-image="true" ${fallback ? `data-preview-fallback="${escapeHTML(fallback)}"` : ''}` : '';
  const labelSummary = sourceCard.language === 'en' ? '' : `<small>English label: ${escapeHTML([card.name, ...labelDetails].filter(Boolean).join(' · '))}</small>`;
  const imageNotice = image ? '' : '<small>The original-language catalog image is unavailable.</small>';
  return `<button class="identification-option" data-image-candidate="${index}" ${previewAttrs} type="button">${imageMarkup}
    <span class="identification-option-copy"><strong>${escapeHTML(sourceCard.name || card.name)}</strong><span>${escapeHTML(sourceDetails.join(' · '))}</span>
    ${labelSummary}${imageNotice}${evidence.length ? `<small>${escapeHTML(evidence.join(' · '))}</small>` : ''}${matchedOn}</span></button>`;
}

function showCandidates(fields, cards, source, adequate) {
  candidateCards = cards;
  const emptyMessage = adequate
    ? 'The catalog could not confirm a safe English match from these details. Enter the English card name and set manually.'
    : 'More distinct card details are needed before the catalog can suggest a safe match. Use the values above to enter the card manually.';
  const options = cards.length ? cards.map(candidateMarkup).join('') : '<p class="catalog-empty">' + emptyMessage + '</p>';
  showDialog(`${readingSummaryMarkup(fields, source, adequate)}<p class="identification-match-note">Choose the card in its printed language. The English catalog match fills Block 2 and the label. This will not save the card.</p><div class="identification-options">${options}</div>`);
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
  const sourceCard = card.sourceCard || card;
  const selected = {...card, sourceCardId: sourceCard.id, sourceCardNumber: sourceCard.cardNumber,
    sourceLanguage: sourceCard.language || 'en', sourceSetId: sourceCard.setId || card.setId, catalogCardId: card.id};
  const metadata = cardLabelMetadata(selected);
  window.__intakeCatalogCard = {...selected, ...metadata};
  document.getElementById('m-name').value = card.name;
  document.getElementById('m-setName').value = metadata.setName || card.setName;
  document.getElementById('m-year').value = card.year;
  document.getElementById('m-cardNumber').value = card.cardNumber;
  document.getElementById('m-rarity').value = card.rarity || '';
  window.__intakeCatalogGame = 'pokemon';
  hideAllCatalogSuggestions();
  const rarityNote = card.rarity ? '' : ' No verified rarity is recorded for this card, so it stays blank.';
  const profileNote = !metadata.labelMetadataReady
    ? ' This language/set has no verified label profile yet, so label printing will stay unavailable until one is added.'
    : !metadata.yearSeries ? ' This set has no approved Year / series mapping yet, so label printing will stay unavailable until one is added.' : '';
  document.getElementById('manual-status').textContent = `English catalog details selected. Check the details, then enter Cert and Grade.${rarityNote}${profileNote}`;
  document.getElementById('identification-result').close();
  hideHoverPreview();
  document.getElementById('m-grade').focus();
}

function showError(message, retryable) {
  const retryButton = retryable
    ? '<div class="identification-error-actions"><button class="btn btn-primary" data-retry-identification type="button">Try again</button></div>'
    : '';
  showDialog(`<div><p class="catalog-empty">${escapeHTML(message)}</p>${retryButton}</div>`);
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
    try {
      result = await identifyCardImage(file);
    } catch (error) {
      if (version === analysisVersion) showError(safeReadingErrorMessage(error), canRetryIdentification(error));
      return;
    }
    if (!result.readingAdequate) {
      if (version === analysisVersion) showCandidates(result.fields, [], result.source, false);
      return;
    }
    let candidates;
    try {
      candidates = await findImageCandidates(result.fields);
      if (!candidates.length) candidates = await findImageReviewCandidates(result.fields);
    } catch {
      if (version === analysisVersion) showError('The card catalog could not be loaded. Try again later.', true);
      return;
    }
    if (version === analysisVersion && candidates.length === 1 && candidates[0].autoSelect) {
      candidateCards = candidates;
      chooseCandidate(0);
      return;
    }
    if (version === analysisVersion) showCandidates(result.fields, candidates, result.source, true);
  } finally {
    analysisBusy = false;
    button.textContent = 'Identify card';
    updateButton();
  }
}

function safeReadingErrorMessage(error) {
  const message = error?.message || '';
  const code = error?.code || '';
  if (/not configured/i.test(message)) return 'Card reading is not configured for this deployment.';
  if (code === 'gemini_quota' || error?.status === 429 || /quota/i.test(message)) return 'Gemini request quota was reached. Try again later.';
  if (/Gemini API configuration is invalid/i.test(message)) return 'Gemini API settings need to be fixed by the site administrator.';
  if (['gemini_timeout', 'gemini_network', 'gemini_upstream', 'gemini_unknown'].includes(code) || error?.status === 503) {
    const requestId = String(error?.requestId || '').match(/^[a-f\d-]{8,}$/i)?.[0]?.slice(0, 8);
    return `Card reading is temporarily unavailable. Try again in a moment.${requestId ? ` Reference: ${requestId}.` : ''}`;
  }
  if (error?.status === 422 || error?.status === 502 || /could not read/i.test(message)) return 'Gemini could not read enough card details from this photo. Try a clearer front image or enter the details manually.';
  if (!error?.status) return 'Could not connect to card reading. Check your connection and try again.';
  return message || 'Card reading could not be completed. Try again in a moment.';
}

function canRetryIdentification(error) {
  if (/not configured|configuration is invalid/i.test(error?.message || '')) return false;
  return !error?.status || error.status === 429 || error.status >= 500;
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
  if (event.target.closest('[data-retry-identification]')) {
    document.getElementById('identification-result')?.close();
    analyzeFront();
    return;
  }
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
    const fallback = option?.dataset.previewFallback;
    if (fallback) {
      option.dataset.previewSrc = fallback;
      option.removeAttribute('data-preview-fallback');
      event.target.src = fallback;
      return;
    }
    option?.removeAttribute('data-preview-src');
    option?.removeAttribute('data-has-image');
    event.target.remove();
  }
  if (event.target.id === 'identification-hover-preview') hideHoverPreview();
}, true);
