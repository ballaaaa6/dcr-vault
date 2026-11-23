import {initializeIntakeNotifications} from './intake-notifications.js';
import {createIntakeCard} from './search-save.js';
import {emptyPhotoMarkup, searchMarkup, validatePhoto} from './search-view.js';
import './search-photo-preview.js';
import {formatRarity} from '../utils/rarity.js';
import {checkCert, deleteCardImage, uploadCardImage} from '../store/cards.js';
import {hideAllCatalogSuggestions, installCatalogSuggestions} from './search-catalog.js';
import {initializeCardRarity, invalidateCardResolution, resolveExactTypedCard, selectCatalogSuggestion} from './search-card-resolution.js';
import {hasNonLatinScript} from '../utils/language.js';
import {makeCert, normalizeCert} from '../utils/cert.js';
import {clearAppliedReading, resetCardIdentificationState} from './card-identification.js';

let certCheckVersion = 0;
let certCheckTimer;
let imageUrls = {};
let uploadedSides = new Set();
let statusObserver;

export function initializeSearchPage() {
  initializeCardRarity();
  statusObserver?.disconnect();
  statusObserver = initializeIntakeNotifications();
}

export function search() {
  releaseObjectUrls();
  resetCardIdentificationState();
  clearAppliedReading();
  uploadedSides = new Set();
  window.__intakeSavedCard = null;
  window.__intakeCatalogGame = '';
  window.__intakeCatalogCard = null;
  window.__intakeIdentification = null;
  window.__intakeIdentityReviewRequired = false;
  return searchMarkup();
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
  const language = document.getElementById('m-sourceLanguage').value.trim().toLowerCase();
  const label = document.getElementById('m-languageLabel');
  label.placeholder = language === 'en' ? 'ENGLISH' : 'THAI or JAPANESE; blank for English';
  document.querySelectorAll('.intake-page .field-grid .form-control').forEach(field => {
    field.classList.toggle('has-value', Boolean(field.value.trim()) || field === label && language === 'en');
  });
  button.disabled = button.dataset.busy === 'true';
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
    setCertState(result.available, result.available ? `Available as ${result.certNumber}.` : `${result.certNumber} is already used. Choose another number.`, result.available ? 'available' : 'error');
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

function updatePhotoPreview(side, file) {
  if (imageUrls[side]) URL.revokeObjectURL(imageUrls[side]);
  const preview = document.querySelector(`[data-image-preview="${side}"]`);
  const clear = document.querySelector(`[data-clear-image="${side}"]`);
  const view = document.querySelector(`[data-view-image="${side}"]`);
  if (!file) {
    delete imageUrls[side];
    preview.innerHTML = emptyPhotoMarkup();
    preview.parentElement.classList.remove('has-image');
    clear.hidden = true;
    view.hidden = true;
    return;
  }
  imageUrls[side] = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${imageUrls[side]}" alt="${side} photo preview">`;
  preview.parentElement.classList.add('has-image');
  clear.hidden = false;
  view.hidden = false;
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

async function saveIntake() {
  const button = document.getElementById('manual-submit');
  const status = document.getElementById('manual-status');
  const certInput = document.getElementById('m-cert');
  const certNumber = normalizeCert(certInput.value);
  const required = [...document.querySelectorAll('.intake-page .field-grid [required]')];
  const missing = required.find(field => !field.value.trim() || !field.checkValidity());
  if (missing) {
    status.textContent = 'Complete all required fields.';
    missing.scrollIntoView({behavior: 'smooth', block: 'center'});
    missing.focus({preventScroll: true});
    return;
  }
  const rarityInput = document.getElementById('m-rarity');
  rarityInput.value = formatRarity(rarityInput.value);
  const englishFields = ['m-name', 'm-setName'].map(id => document.getElementById(id).value.trim());
  if (englishFields.some(hasNonLatinScript)) {
    status.textContent = 'Use English card and set names from the catalog before saving.';
    document.getElementById('m-name').focus();
    return;
  }
  if (!certNumber) { setCertState(false, 'Enter 1 to 8 digits.', 'error'); certInput.focus(); return; }
  button.dataset.busy = 'true';
  updateSubmitState();
  try {
    if (certInput.dataset.certAvailable !== 'true' && !await checkCertInput()) { certInput.focus(); return; }
    const card = window.__intakeSavedCard || await createIntakeCard(certNumber);
    if (!selectedPhotos().length) { location.href = '/vault'; return; }
    status.textContent = 'Uploading selected photos…';
    const failed = await uploadPhotos(card);
    if (failed.length) { status.textContent = `Card saved. Retry the photos that failed: ${failed.join('; ')}`; button.textContent = 'Retry photo upload'; return; }
    location.href = '/vault';
  } catch (error) {
    if (error.status === 409) setCertState(false, 'This Cert number is already used. Choose another number.', 'error');
    else { status.dataset.state = 'error'; status.textContent = error.message || 'The card could not be saved.'; }
  } finally {
    button.dataset.busy = 'false';
    updateSubmitState();
  }
}

window.addEventListener('intake-values-updated', updateSubmitState);

document.addEventListener('input', event => {
  if (event.target.closest('.intake-page')) updateSubmitState();
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
  if (event.target.closest('.intake-page')) updateSubmitState();
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

document.addEventListener('dragover', event => {
  const field = event.target.closest('[data-drop-side]');
  if (!field) return;
  event.preventDefault();
  field.classList.add('is-dragging');
});

document.addEventListener('dragleave', event => {
  const field = event.target.closest('[data-drop-side]');
  if (field && !field.contains(event.relatedTarget)) field.classList.remove('is-dragging');
});

document.addEventListener('drop', event => {
  const field = event.target.closest('[data-drop-side]');
  if (!field) return;
  event.preventDefault();
  field.classList.remove('is-dragging');
  if (!event.dataTransfer.files.length) return;
  const input = field.querySelector('[data-upload-side]');
  const files = new DataTransfer();
  files.items.add(event.dataTransfer.files[0]);
  input.files = files.files;
  input.dispatchEvent(new Event('change', {bubbles: true}));
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
  selectCatalogSuggestion(card);
  const languageInput = document.getElementById('m-sourceLanguage');
  if (!languageInput.value) languageInput.value = card.language || '';
  const typeInput = document.getElementById('m-cardTypeLabel');
  if (!typeInput.value) typeInput.value = 'POKÉMON';
  document.getElementById('m-rarity').value = formatRarity(card.rarity);
  document.getElementById('manual-status').textContent = 'Catalog card selected. Check the details, then enter Cert and Grade.';
  updateSubmitState();
  document.getElementById('m-grade').focus();
}, () => {
  invalidateCardResolution();
  window.__intakeCatalogCard = null;
  const language = window.__intakeIdentification?.sourceLanguage;
  window.__intakeIdentification = language ? {language, sourceLanguage: language} : null;
});
