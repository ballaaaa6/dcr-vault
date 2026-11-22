import {catalogField} from './search-catalog.js';
import {CONDITION_OPTIONS, conditionOptionLabel} from '../utils/label-options.js';
import {identificationDialogMarkup} from './card-identification.js';

function photoField(side, label) {
  return `<div class="upload-item"><span class="upload-label">${label}</span><div class="upload-frame">
    <label class="upload-field" for="m-image-${side}" data-drop-side="${side}">
      <input id="m-image-${side}" data-upload-side="${side}" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose ${label.toLowerCase()}">
      <div class="upload-preview" data-image-preview="${side}">${emptyPhotoMarkup()}</div>
    </label><button class="btn upload-view" data-view-image="${side}" type="button" aria-label="Preview ${label.toLowerCase()}" hidden><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 5 5"></path></svg>Preview</button><button class="upload-clear" data-clear-image="${side}" type="button" aria-label="Remove ${label.toLowerCase()}" title="Remove ${label.toLowerCase()}" hidden>×</button>
  </div></div>`;
}

export function emptyPhotoMarkup() {
  return `<svg class="upload-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m4 17 5-5 3 3 3-3 5 5"></path></svg><strong>Click to upload</strong><span>or drag and drop</span><small>JPG, PNG or WebP · up to 10 MB</small>`;
}

export function searchMarkup() {
  return `
    <main class="app-page intake-page">
      <header class="page-heading"><div class="page-eyebrow">COLLECTION INTAKE</div><h1>Add a card to your vault</h1><p class="page-description">Saved card details and photos stay private to your signed-in account.</p></header>
      <div class="intake-grid">
        <section class="surface-card intake-card" aria-labelledby="scan-title">
          <div class="section-heading"><div><h2 id="scan-title">Card images</h2><p>Choose a front and/or back photo to store in your private image vault.</p></div></div>
          <div class="upload-grid">${photoField('front', 'Front image')}${photoField('back', 'Back image')}</div>
          <div class="identification-actions"><button class="btn btn-ghost" id="identify-card" type="button" disabled>Identify card</button></div>
          <p class="identification-notice">Give your card a head start. Upload a front photo and let us fill in the details for you. Take a moment to review them before adding your card to the vault.</p>
          <p id="photo-status" class="import-status" role="status" aria-live="polite"></p>
        </section>
        <section class="surface-card intake-card" aria-labelledby="manual-title">
          <div class="section-heading"><div><div class="card-details-title"><h2 id="manual-title">Card details</h2><button id="identification-info" class="identification-info" type="button" aria-label="View card reading details" title="View card reading details" hidden>i</button></div><p>Review the printed card number and English card details; Cert and Grade stay independent.</p></div></div>
          <div class="field-grid">
            ${catalogField('name', 'Name', 'e.g. Charizard')}
            ${catalogField('setName', 'Set', 'e.g. Base Set')}
            ${catalogField('year', 'Year', 'e.g. 1999')}
            ${catalogField('cardNumber', 'Card number', 'e.g. 4')}
            <div class="form-field"><label for="m-cardTypeLabel">Card type</label><input class="form-control" id="m-cardTypeLabel" maxlength="60" placeholder="e.g. POKÉMON"></div>
            <div class="form-field"><label for="m-series">Series</label><input class="form-control" id="m-series" maxlength="120" placeholder="e.g. SCARLET &amp; VIOLET"></div>
            <div class="form-field"><label for="m-sourceLanguage">Language code</label><input class="form-control" id="m-sourceLanguage" maxlength="20" placeholder="en, th, ja"></div>
            <div class="form-field"><label for="m-languageLabel">Language label</label><input class="form-control" id="m-languageLabel" maxlength="60" placeholder="THAI or JAPANESE; blank for English"></div>
            <div class="form-field"><label for="m-rarity">Rarity <span class="required-mark" aria-hidden="true">*</span></label><input class="form-control" id="m-rarity" required placeholder="Read from card or choose from catalog"></div>
            <div class="form-field intake-wide"><label for="m-artist">Artist / Illustrator <span class="optional-label">(optional)</span></label><input class="form-control" id="m-artist" maxlength="120" placeholder="e.g. Mitsuhiro Arita"></div>
            <div class="form-field"><label for="m-grade">Condition / Grade <span class="required-mark" aria-hidden="true">*</span></label><select class="form-control" id="m-grade" required><option value="">Choose condition</option>${CONDITION_OPTIONS.map(value => `<option value="${value}">${conditionOptionLabel(value)}</option>`).join('')}</select></div>
            <div class="form-field cert-field"><label for="m-cert">Cert number <span class="required-mark" aria-hidden="true">*</span></label><span class="cert-input-row">
              <input class="form-control" id="m-cert" inputmode="numeric" maxlength="8" pattern="[0-9]{1,8}" placeholder="1 to 8 digits" required>
              <button class="btn btn-ghost cert-random" data-cert-random type="button" aria-label="Generate an available Cert number" title="Generate an available Cert number">
                <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3"></rect><circle cx="8" cy="8" r="1"></circle><circle cx="16" cy="8" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="8" cy="16" r="1"></circle><circle cx="16" cy="16" r="1"></circle></svg>
              </button>
            </span><small id="m-cert-status" class="field-status" role="status" aria-live="polite"></small></div>
            <button class="btn btn-primary manual-submit" id="manual-submit" type="button">Add to Vault</button>
            <p id="manual-status" class="import-status intake-wide" role="status" aria-live="polite"></p>
          </div>
        </section>
      </div>
      <dialog class="photo-viewer" id="photo-viewer" aria-label="Card image preview"><button class="photo-viewer-close" type="button" data-close-photo-viewer aria-label="Close preview">×</button><img alt=""></dialog>
      ${identificationDialogMarkup()}
    </main>`;
}

const IMAGE_LIMIT = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validatePhoto(input) {
  const file = input.files?.[0];
  if (!file) return null;
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > IMAGE_LIMIT) throw new Error('Each photo must be 10 MB or smaller.');
  return file;
}
