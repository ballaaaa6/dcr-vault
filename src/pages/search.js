import {initializeIntakeNotifications} from './intake-notifications.js';
import {showToast} from '../components/toast.js';
import {createIntakeCard} from './search-save.js';
import {emptyPhotoMarkup, searchMarkup, validatePhoto} from './search-view.js';
import './search-photo-preview.js';
import {formatRarity} from '../utils/rarity.js';
import {checkCert, deleteCardImage, uploadCardImage} from '../store/cards.js';
import {destroyCatalogSuggestions, initializeCatalogSuggestions, installCatalogSuggestions, invalidateCatalogSuggestions, closeCatalogOnOutsideClick} from './search-catalog.js';
import {initializeCardRarity, invalidateCardResolution, resolveExactTypedCard} from './search-card-resolution.js';
import {hasNonLatinScript} from '../utils/language.js';
import {findAvailableCert, normalizeCert} from '../utils/cert.js';
import {clearAppliedReading, resetCardIdentificationState} from './card-identification.js';
import {languageCode, languageName} from '../utils/intake-options.js';
import {standardLabelValues} from './card-identification-helpers.js';

let certCheckVersion = 0;
let certCheckTimer;
let imageUrls = {};
let uploadedSides = new Set();
let statusObserver;

export function initializeSearchPage() {
  initializeCardRarity();
  initializeCatalogSuggestions().catch(() => {
    const status = document.getElementById('manual-status');
    if (status) { status.dataset.state = 'error'; status.textContent = 'Card fields could not be loaded. Reload and try again.'; }
  });
  statusObserver?.disconnect();
  statusObserver = initializeIntakeNotifications();
}

export function search() {
  destroyCatalogSuggestions();
  releaseObjectUrls();
  resetCardIdentificationState();
  clearAppliedReading();
  uploadedSides = new Set();
  window.__intakeSavedCard = null;
  window.__intakeCatalogGame = 'pokemon';
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
  document.querySelectorAll('.intake-page .field-grid .form-control').forEach(field => {
    field.classList.toggle('has-value', Boolean(field.value.trim()));
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
  const version = ++certCheckVersion;
  clearTimeout(certCheckTimer);
  const previousAvailable = input.dataset.certAvailable === 'true';
  const previousValue = input.value;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.setAttribute('aria-label', 'Finding an available Cert number');
  setCertState(previousAvailable, '');
  try {
    const cert = await findAvailableCert(checkCert, previousValue);
    if (version !== certCheckVersion || !input.isConnected) return;
    input.value = cert;
    setCertState(true, `${cert} is available.`, 'available');
  } catch (error) {
    if (version === certCheckVersion && input.isConnected) {
      setCertState(previousAvailable, error.message === 'Could not find a free number. Try again.' ? error.message : 'Could not check a random number. Try again.', 'error');
    }
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.setAttribute('aria-label', 'Generate an available Cert number');
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

function completeIntake() {
  certCheckVersion += 1;
  clearTimeout(certCheckTimer);
  invalidateCatalogSuggestions();
  invalidateCardResolution();
  document.querySelector('.intake-page').outerHTML = search();
  initializeSearchPage();
  showToast('Card added to your vault.', 'success', {key: 'intake-save'});
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
    const visible = missing.dataset.catalogField ? document.getElementById(`${missing.id}-input`) : document.getElementById(`${missing.id}-trigger`) || missing;
    visible?.scrollIntoView({behavior: 'smooth', block: 'center'});
    visible?.focus({preventScroll: true});
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
    status.dataset.toastKey = 'save';
    status.dataset.state = 'pending';
    status.textContent = 'Adding card to your vault…';
    const card = window.__intakeSavedCard || await createIntakeCard(certNumber);
    if (selectedPhotos().length) {
      status.textContent = 'Uploading selected photos…';
      const failed = await uploadPhotos(card);
      if (failed.length) { status.dataset.state = 'error'; status.textContent = `Card saved. Retry the photos that failed: ${failed.join('; ')}`; button.textContent = 'Retry photo upload'; return; }
    }
    completeIntake();
  } catch (error) {
    if (error.status === 409) {
      status.dataset.state = 'error';
      status.textContent = 'This Cert number is already used. Choose another number.';
      setCertState(false, '', 'error');
    }
    else { status.dataset.state = 'error'; status.textContent = error.message || 'The card could not be saved.'; }
  } finally {
    button.dataset.busy = 'false';
    updateSubmitState();
  }
}

window.addEventListener('intake-values-updated', () => {
  const language = document.getElementById('m-language');
  const code = document.getElementById('m-sourceLanguage');
  if (language && code && document.activeElement !== language) language.value = languageName(code.value);
  updateSubmitState();
});

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
  closeCatalogOnOutsideClick(event.target);
});

document.addEventListener('focusout', event => {
  const field = event.target.closest('[data-catalog-field]');
  if (field) resolveExactTypedCard();
  if (event.target.id === 'm-cert') {
    const normalized = normalizeCert(event.target.value);
    if (normalized) event.target.value = normalized;
  }
});

installCatalogSuggestions(field => {
  invalidateCardResolution();
  window.__intakeCatalogCard = null;
  if (['language', 'year', 'series', 'setName', 'cardNumber', 'name'].includes(field)) document.getElementById('m-artist').value = '';
  if (field === 'language') {
    const code = languageCode(document.getElementById('m-language').value);
    document.getElementById('m-sourceLanguage').value = code;
    document.getElementById('m-languageLabel').value = standardLabelValues({cardTypeLabel: 'POKÉMON', language: code}).languageLabel;
  }
  const language = document.getElementById('m-sourceLanguage').value;
  window.__intakeIdentification = language ? {language, sourceLanguage: language} : null;
});
