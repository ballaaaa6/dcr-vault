import {initializeIntakeNotifications} from './intake-notifications.js';
import {showToast} from '../components/toast.js';
import {createIntakeCard, updateIntakeCard} from './search-save.js';
import {emptyPhotoMarkup, searchMarkup, validatePhoto} from './search-view.js';
import './search-photo-preview.js';
import {checkCert, deleteCardImage, uploadCardImage} from '../store/cards.js';
import {CARD_CORNERS} from '../utils/card-corners.js';
import {animateCornerSwitch} from '../components/corner-switch.js';
import {destroyCatalogSuggestions, initializeCatalogSuggestions, installCatalogSuggestions, invalidateCatalogSuggestions, closeCatalogOnOutsideClick} from './search-catalog.js';
import {findAvailableCert, normalizeCert} from '../utils/cert.js';
import {clearAppliedReading, resetCardIdentificationState} from './card-identification.js';

let certCheckVersion = 0;
let certCheckTimer;
let imageUrls = {};
let uploadedSides = new Set();
let statusObserver;
let editCard = null;
let removedSides = new Set();

export function initializeSearchPage() {
  if (editCard) initializeEditCard(editCard);
  else document.getElementById('m-rarity').value = '';
  initializeCatalogSuggestions().catch(() => {
    const status = document.getElementById('manual-status');
    if (status) { status.dataset.state = 'error'; status.textContent = 'Card fields could not be loaded. Reload and try again.'; }
  });
  statusObserver?.disconnect();
  statusObserver = initializeIntakeNotifications();
}

export function search(card = null) {
  editCard = card;
  removedSides = new Set();
  destroyCatalogSuggestions();
  releaseObjectUrls();
  resetCardIdentificationState();
  clearAppliedReading();
  uploadedSides = new Set();
  window.__intakeSavedCard = null;
  window.__intakeCatalogGame = '';
  window.__intakeCatalogCard = null;
  window.__intakeIdentification = null;
  window.__intakeIdentityReviewRequired = false;
  return searchMarkup(card);
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

function animateCertDice(button) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const icon = button.querySelector('svg');
  if (!icon) return;
  icon.classList.remove('cert-dice-spin');
  void icon.getBoundingClientRect();
  icon.classList.add('cert-dice-spin');
  icon.onanimationend = event => {
    if (event.animationName === 'cert-spin') icon.classList.remove('cert-dice-spin');
  };
}

async function generateCert() {
  const button = document.querySelector('[data-cert-random]');
  const input = document.getElementById('m-cert');
  if (!button || !input) return;
  animateCertDice(button);
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

function initializeEditCard(card) {
  const fields = {game: card.game, language: card.sourceLanguage || card.languageLabel, year: card.year,
    setName: card.setName, cardNumber: card.cardNumber, name: card.name, rarity: card.rarity,
    sourceLanguage: card.sourceLanguage, languageLabel: card.languageLabel, artist: card.artist, cert: card.certNumber};
  for (const [key, value] of Object.entries(fields)) document.getElementById(`m-${key}`).value = value || '';
  const cert = document.getElementById('m-cert');
  cert.readOnly = true;
  document.querySelector('[data-cert-random]').disabled = true;
  document.querySelector('.page-heading h1').textContent = 'Change Card Details';
  document.querySelector('.page-heading .page-description').textContent = `Your Cert ${card.certNumber} stays reserved for this card.`;
  document.querySelector('#manual-submit span').textContent = 'Save changes';
  for (const side of ['front', 'back', ...CARD_CORNERS.map(([key]) => key)]) {
    const imageUrl = card[`${side}Image`] || card.cornerImages?.[side];
    if (!imageUrl) continue;
    const preview = document.querySelector(`[data-image-preview="${side}"]`);
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = `${side} photo preview`;
    preview.replaceChildren(image);
    preview.parentElement.classList.add('has-image');
    document.querySelector(`[data-clear-image="${side}"]`).hidden = false;
    document.querySelector(`[data-view-image="${side}"]`).hidden = false;
  }
}

async function clearPhoto(side) {
  const input = document.querySelector(`[data-upload-side="${side}"]`);
  if (editCard) removedSides.add(side);
  if (!editCard && window.__intakeSavedCard && uploadedSides.has(side)) {
    try { await deleteCardImage(window.__intakeSavedCard.id, side); uploadedSides.delete(side); }
    catch (error) { document.getElementById('photo-status').textContent = error.message; return; }
  }
  input.value = '';
  updatePhotoPreview(side, null);
  if (side === 'front') window.dispatchEvent(new Event('intake-front-image-cleared'));
  document.getElementById('photo-status').textContent = 'Photo selection cleared.';
}

function selectedPhotos() {
  return ['front', 'back', ...CARD_CORNERS.map(([key]) => key)].map(side => ({side, file: document.querySelector(`[data-upload-side="${side}"]`).files?.[0]}))
    .filter(item => item.file);
}

async function uploadPhotos(card) {
  const photos = selectedPhotos().filter(item => !uploadedSides.has(item.side));
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
  if (!certNumber) { setCertState(false, 'Enter 1 to 8 digits.', 'error'); certInput.focus(); return; }
  button.dataset.busy = 'true';
  button.querySelector('span').textContent = 'Saving…';
  updateSubmitState();
  try {
    if (!editCard && !window.__intakeSavedCard && certInput.dataset.certAvailable !== 'true' && !await checkCertInput()) { button.querySelector('span').textContent = 'Add card'; certInput.focus(); return; }
    status.dataset.toastKey = 'save';
    status.dataset.state = 'pending';
    status.textContent = editCard ? 'Saving card changes…' : 'Adding card to your vault…';
    const card = editCard ? await updateIntakeCard(editCard) : window.__intakeSavedCard || await createIntakeCard(certNumber);
    if (selectedPhotos().length) {
      status.textContent = 'Uploading selected photos…';
      const failed = await uploadPhotos(card);
      if (failed.length) { status.dataset.state = 'error'; status.textContent = `Card saved. Retry the photos that failed: ${failed.join('; ')}`; button.querySelector('span').textContent = 'Try again'; return; }
    }
    if (editCard) {
      for (const side of removedSides) {
        if (!selectedPhotos().some(photo => photo.side === side) && (card[`${side}Image`] || card.cornerImages?.[side])) await deleteCardImage(card.id, side);
      }
      location.href = `/vault?id=${encodeURIComponent(card.id)}`;
      return;
    }
    completeIntake();
  } catch (error) {
    button.querySelector('span').textContent = 'Try again';
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
  if (language && code && document.activeElement !== language) language.value = code.value;
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
  uploadedSides.delete(input.dataset.uploadSide);
  if (editCard) removedSides.delete(input.dataset.uploadSide);
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
  const cornerSwitch = event.target.closest('[data-corner-switch]');
  if (cornerSwitch) {
    const section = cornerSwitch.closest('.intake-card');
    const showing = cornerSwitch.getAttribute('aria-pressed') !== 'true';
    cornerSwitch.setAttribute('aria-pressed', String(showing));
    cornerSwitch.setAttribute('aria-label', showing ? 'Show front and back images' : 'Show back corners');
    section.querySelector('.corner-upload-flipper').classList.toggle('show-corners', showing);
    section.querySelector('.corner-main').inert = showing;
    section.querySelector('.corner-grid').inert = !showing;
    animateCornerSwitch(cornerSwitch);
    return;
  }
  const clear = event.target.closest('[data-clear-image]');
  if (clear) { clearPhoto(clear.dataset.clearImage); return; }
  if (event.target.closest('[data-cert-random]')) { generateCert(); return; }
  if (event.target.closest('#manual-submit')) saveIntake();
  closeCatalogOnOutsideClick(event.target);
});

document.addEventListener('focusout', event => {
  if (event.target.id === 'm-cert') {
    const normalized = normalizeCert(event.target.value);
    if (normalized) event.target.value = normalized;
  }
});

installCatalogSuggestions(field => {
  window.__intakeCatalogCard = null;
  if (['language', 'year', 'series', 'setName', 'cardNumber', 'name'].includes(field)) document.getElementById('m-artist').value = '';
  if (field === 'language') {
    const language = document.getElementById('m-language').value.trim();
    document.getElementById('m-sourceLanguage').value = language;
    document.getElementById('m-languageLabel').value = '';
  }
});
