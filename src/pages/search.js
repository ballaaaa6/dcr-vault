import {formatRarity} from '../utils/rarity.js';
import {addCard, checkCert, deleteCardImage, uploadCardImage} from '../store/cards.js';
import {catalogField, hideAllCatalogSuggestions, installCatalogSuggestions} from './search-catalog.js';
import {initializeCardRarity, invalidateCardResolution, resolveExactTypedCard, selectCatalogSuggestion} from './search-card-resolution.js';
import {CONDITION_OPTIONS} from '../utils/label-options.js';
import {cardLabelMetadata} from '../utils/label-metadata.js';
import {escapeHTML} from '../utils/format.js';
import {hasNonLatinScript} from '../utils/language.js';
import {makeCert, normalizeCert} from '../utils/cert.js';
import {identificationDialogMarkup, resetCardIdentificationState} from './card-identification.js';

const IMAGE_LIMIT = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
let certCheckVersion = 0;
let certCheckTimer;
let imageUrls = {};
let uploadedSides = new Set();

export {initializeCardRarity as initializeSearchPage};

function photoField(side, label) {
  return `<div class="upload-item"><label class="upload-field" for="m-image-${side}"><span>${label}</span>
    <input id="m-image-${side}" data-upload-side="${side}" type="file" accept="image/jpeg,image/png,image/webp">
    <div class="upload-preview" data-image-preview="${side}"><span>Choose a photo · up to 10 MB</span></div>
  </label><button class="btn btn-ghost upload-clear" data-clear-image="${side}" type="button" disabled>Remove photo</button></div>`;
}

export function search() {
  releaseObjectUrls();
  resetCardIdentificationState();
  uploadedSides = new Set();
  window.__intakeSavedCard = null;
  window.__intakeCatalogGame = '';
  window.__intakeCatalogCard = null;
  window.__intakeIdentification = null;
  return `
    <main class="app-page">
      <header class="page-heading"><div class="page-eyebrow">COLLECTION INTAKE</div><h1>Add a card to your vault</h1><p class="page-description">Saved card details and photos stay private to your signed-in account.</p></header>
      <div class="intake-grid">
        <section class="surface-card intake-card" aria-labelledby="scan-title">
          <div class="section-heading"><span class="section-number">01</span><div><h2 id="scan-title">Card images</h2><p>Choose a front and/or back photo to store in your private image vault.</p></div></div>
          <div class="upload-grid">${photoField('front', 'Front image')}${photoField('back', 'Back image')}</div>
          <div class="identification-actions"><button class="btn btn-ghost" id="identify-card" type="button" disabled>Identify card</button></div>
          <p class="identification-notice">Click Identify card to send the front photo to Google Gemini. Gemini reads the card and the catalog checks the printed identity; review or correct the result before saving. Google applies your API tier's data terms; DCR stores the photo only after you click Add to Vault.</p>
          <p id="photo-status" class="import-status" role="status" aria-live="polite"></p>
        </section>
        <section class="surface-card intake-card" aria-labelledby="manual-title">
          <div class="section-heading"><span class="section-number">02</span><div><h2 id="manual-title">Card details</h2><p>Review the printed card number and English card details; Cert and Grade stay independent.</p></div></div>
          <div class="field-grid">
            ${catalogField('name', 'Name', 'e.g. Charizard')}
            <div class="form-field cert-field"><label for="m-cert">Cert number</label><span class="cert-input-row">
              <input class="form-control" id="m-cert" inputmode="numeric" maxlength="8" pattern="[0-9]{1,8}" placeholder="1 to 8 digits" required>
              <button class="btn btn-ghost cert-random" data-cert-random type="button" aria-label="Generate an available Cert number" title="Generate an available Cert number">
                <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3"></rect><circle cx="8" cy="8" r="1"></circle><circle cx="16" cy="8" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="8" cy="16" r="1"></circle><circle cx="16" cy="16" r="1"></circle></svg>
              </button>
            </span><small id="m-cert-status" class="field-status" role="status" aria-live="polite"></small></div>
            ${catalogField('setName', 'Set', 'e.g. Base Set')}
            ${catalogField('year', 'Year', 'e.g. 1999')}
            ${catalogField('cardNumber', 'Card number', 'e.g. 4')}
            <div class="form-field"><label for="m-rarity">Rarity</label><input class="form-control" id="m-rarity" placeholder="Read from card or choose from catalog"></div>
            <div class="form-field"><label for="m-grade">Grade / Condition</label><select class="form-control" id="m-grade"><option value="">Choose condition</option>${CONDITION_OPTIONS.map(value => `<option value="${value}">${value}</option>`).join('')}</select></div>
          </div>
          <button class="btn btn-primary manual-submit" id="manual-submit" type="button">Add to Vault</button>
          <p id="manual-status" class="import-status" role="status" aria-live="polite"></p>
        </section>
      </div>
      ${identificationDialogMarkup()}
    </main>`;
}

function setCertState(available, message, state = '') {
  const input = document.getElementById('m-cert');
  const status = document.getElementById('m-cert-status');
  if (!input || !status) return;
  input.dataset.certAvailable = available ? 'true' : 'false';
  input.setAttribute('aria-invalid', state === 'error' ? 'true' : 'false');
  status.dataset.state = state;
  status.textContent = message;
  updateSubmitState();
}

function updateSubmitState() {
  const button = document.getElementById('manual-submit');
  const input = document.getElementById('m-cert');
  if (!button || !input) return;
  const cert = normalizeCert(input.value);
  button.disabled = button.dataset.busy === 'true' || Boolean(cert && input.dataset.certAvailable !== 'true');
}

async function checkCertInput() {
  const input = document.getElementById('m-cert');
  if (!input) return false;
  const version = ++certCheckVersion;
  const cert = normalizeCert(input.value);
  if (!input.value.trim()) { setCertState(false, ''); return false; }
  if (!cert) { setCertState(false, 'Enter 1 to 8 digits.', 'error'); return false; }
  setCertState(false, 'Checking this Cert number…', 'pending');
  try {
    const result = await checkCert(cert);
    if (version !== certCheckVersion || normalizeCert(input.value) !== cert) return false;
    setCertState(result.available, result.available ? `Available as ${result.certNumber}.` : `${result.certNumber} is already used in your vault. Choose another number.`, result.available ? 'available' : 'error');
    return result.available;
  } catch {
    if (version === certCheckVersion) setCertState(false, 'Could not check this Cert number. Try again.', 'error');
    return false;
  }
}

async function generateCert() {
  const button = document.querySelector('[data-cert-random]');
  const input = document.getElementById('m-cert');
  if (!button || !input) return;
  certCheckVersion += 1;
  clearTimeout(certCheckTimer);
  button.disabled = true;
  setCertState(false, 'Finding an available Cert number…', 'pending');
  try {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = makeCert();
      const result = await checkCert(candidate);
      if (result.available) {
        input.value = result.certNumber;
        setCertState(true, `${result.certNumber} is available.`, 'available');
        return;
      }
    }
    setCertState(false, 'Could not find a free number. Try again.', 'error');
  } catch {
    setCertState(false, 'Could not check a random number. Try again.', 'error');
  } finally {
    button.disabled = false;
  }
}

function validatePhoto(input) {
  const file = input.files?.[0];
  if (!file) return null;
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > IMAGE_LIMIT) throw new Error('Each photo must be 10 MB or smaller.');
  return file;
}

function updatePhotoPreview(side, file) {
  if (imageUrls[side]) URL.revokeObjectURL(imageUrls[side]);
  const preview = document.querySelector(`[data-image-preview="${side}"]`);
  const clear = document.querySelector(`[data-clear-image="${side}"]`);
  if (!file) {
    delete imageUrls[side];
    preview.innerHTML = '<span>Choose a photo · up to 10 MB</span>';
    clear.disabled = true;
    return;
  }
  imageUrls[side] = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${imageUrls[side]}" alt="${side} photo preview"><span>${escapeHTML(file.name)}</span>`;
  clear.disabled = false;
}

function releaseObjectUrls() {
  Object.values(imageUrls).forEach(URL.revokeObjectURL);
  imageUrls = {};
}

async function clearPhoto(side) {
  const input = document.querySelector(`[data-upload-side="${side}"]`);
  if (window.__intakeSavedCard && uploadedSides.has(side)) {
    try { await deleteCardImage(window.__intakeSavedCard.id, side); uploadedSides.delete(side); }
    catch (error) { document.getElementById('photo-status').textContent = error.message; return; }
  }
  input.value = '';
  updatePhotoPreview(side, null);
  if (side === 'front') window.dispatchEvent(new Event('intake-front-image-cleared'));
  document.getElementById('photo-status').textContent = 'Photo selection cleared.';
}

function selectedPhotos() {
  return ['front', 'back'].map(side => ({side, file: document.querySelector(`[data-upload-side="${side}"]`).files?.[0]}))
    .filter(item => item.file);
}

async function uploadPhotos(card) {
  const photos = selectedPhotos();
  const results = await Promise.allSettled(photos.map(item => uploadCardImage(card.id, item.side, item.file)));
  const failed = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') uploadedSides.add(photos[index].side);
    else failed.push(`${photos[index].side}: ${result.reason.message || 'upload failed'}`);
  });
  return failed;
}

function formCard(certNumber) {
  const selected = window.__intakeCatalogCard || window.__intakeIdentification || {};
  const metadata = cardLabelMetadata(selected);
  return {
    game: window.__intakeCatalogGame || 'other', name: document.getElementById('m-name').value.trim(), certNumber,
    setName: document.getElementById('m-setName').value.trim(), year: document.getElementById('m-year').value.trim(),
    yearSeries: metadata.yearSeries, catalogCardId: metadata.catalogCardId,
    sourceLanguage: metadata.sourceLanguage, sourceSetId: metadata.sourceSetId,
    sourceCardId: selected.sourceCardId || '', sourceFinish: selected.sourceFinish || '',
    cardNumber: document.getElementById('m-cardNumber').value.trim(), rarity: document.getElementById('m-rarity').value.trim(),
    gradeLabel: document.getElementById('m-grade').value.trim(), status: 'in-vault'
  };
}

async function createIntakeCard(certNumber) {
  if (!window.__intakeCatalogCard) await resolveExactTypedCard();
  const card = await addCard(formCard(certNumber));
  window.__intakeSavedCard = card;
  return card;
}

async function saveIntake() {
  const button = document.getElementById('manual-submit');
  const status = document.getElementById('manual-status');
  const certInput = document.getElementById('m-cert');
  const certNumber = normalizeCert(certInput.value);
  const rarityInput = document.getElementById('m-rarity');
  rarityInput.value = formatRarity(rarityInput.value);
  if (rarityInput.value) {
    const {rarityFitsLabel} = await import('../utils/label-renderer.js');
    const setName = document.getElementById('m-setName').value.trim();
    if (!rarityFitsLabel(setName, rarityInput.value)) {
      status.textContent = 'Set and rarity do not fit on the label. Shorten one before saving.';
      rarityInput.focus();
      return;
    }
  }
  const englishFields = ['m-name', 'm-setName'].map(id => document.getElementById(id).value.trim());
  if (englishFields.some(hasNonLatinScript)) {
    status.textContent = 'Use English card and set names from the catalog before saving.';
    document.getElementById('m-name').focus();
    return;
  }
  if (!document.getElementById('m-name').value.trim()) { status.textContent = 'Enter a card name.'; document.getElementById('m-name').focus(); return; }
  if (!certNumber) { setCertState(false, 'Enter 1 to 8 digits.', 'error'); certInput.focus(); return; }
  if (certInput.dataset.certAvailable !== 'true' && !await checkCertInput()) { certInput.focus(); return; }
  button.dataset.busy = 'true';
  updateSubmitState();
  try {
    const card = window.__intakeSavedCard || await createIntakeCard(certNumber);
    if (!selectedPhotos().length) { location.hash = '#/vault'; return; }
    status.textContent = 'Uploading selected photos…';
    const failed = await uploadPhotos(card);
    if (failed.length) { status.textContent = `Card saved. Retry the photos that failed: ${failed.join('; ')}`; button.textContent = 'Retry photo upload'; return; }
    location.hash = '#/vault';
  } catch (error) {
    if (error.status === 409) setCertState(false, 'This Cert number is already used. Choose another number.', 'error');
    else status.textContent = error.message || 'The card could not be saved.';
  } finally {
    button.dataset.busy = 'false';
    updateSubmitState();
  }
}

document.addEventListener('input', event => {
  if (event.target.id === 'm-cert') {
    certCheckVersion += 1;
    clearTimeout(certCheckTimer);
    const value = event.target.value.trim();
    const cert = normalizeCert(value);
    if (!value) setCertState(false, '');
    else if (!cert) setCertState(false, 'Enter 1 to 8 digits.', 'error');
    else setCertState(false, 'Checking this Cert number…', 'pending');
    certCheckTimer = setTimeout(checkCertInput, 220);
  }
});

document.addEventListener('change', event => {
  const input = event.target.closest('[data-upload-side]');
  if (!input) return;
  try { updatePhotoPreview(input.dataset.uploadSide, validatePhoto(input)); document.getElementById('photo-status').textContent = ''; }
  catch (error) {
    input.value = '';
    updatePhotoPreview(input.dataset.uploadSide, null);
    if (input.dataset.uploadSide === 'front') window.dispatchEvent(new Event('intake-front-image-cleared'));
    document.getElementById('photo-status').textContent = error.message;
  }
});

document.addEventListener('click', event => {
  const clear = event.target.closest('[data-clear-image]');
  if (clear) { clearPhoto(clear.dataset.clearImage); return; }
  if (event.target.closest('[data-cert-random]')) { generateCert(); return; }
  if (event.target.closest('#manual-submit')) saveIntake();
  if (!event.target.closest('[data-catalog-control]')) hideAllCatalogSuggestions();
});

document.addEventListener('focusout', event => {
  const field = event.target.closest('[data-catalog-field]');
  if (field) resolveExactTypedCard();
  if (event.target.id === 'm-cert') {
    const normalized = normalizeCert(event.target.value);
    if (normalized) event.target.value = normalized;
  }
});

installCatalogSuggestions(card => {
  invalidateCardResolution();
  const metadata = selectCatalogSuggestion(card);
  document.getElementById('m-rarity').value = formatRarity(card.rarity);
  document.getElementById('manual-status').textContent = !metadata.labelMetadataReady
    ? 'This language/set has no verified label profile yet, so label printing will stay unavailable until one is added.'
    : !metadata.yearSeries
      ? 'This set has no approved Year / series mapping yet, so label printing will stay unavailable until one is added.'
      : 'Catalog card selected. Check the details, then enter Cert and Grade.';
  document.getElementById('m-grade').focus();
}, () => {
  invalidateCardResolution();
  window.__intakeCatalogCard = null;
});
