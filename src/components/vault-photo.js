import {escapeHTML} from '../utils/format.js';
import {certificatePath, normalizeCert} from '../utils/cert.js';
import {initializeImageZoom} from './image-zoom.js';
import {cardImageVariant} from '../utils/card-image-variant.js';

const flipIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-5V2M4 17h5v5M20 7a8 8 0 0 0-14-2M4 17a8 8 0 0 0 14 2"/></svg>';
const searchIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>';

function faces(card, isDialog = false) {
  const front = card.referenceImage || card.frontImage;
  const image = (url, side) => url ? `<img src="${escapeHTML(isDialog ? url : cardImageVariant(url, 'medium'))}" data-fallback="${escapeHTML(side === 'Front' && card.referenceImage ? (isDialog ? card.frontImage || '' : cardImageVariant(card.frontImage, 'medium')) : '')}" alt="${escapeHTML(card.name)} — ${side}" referrerpolicy="no-referrer"${isDialog || side === 'Back' ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async">` : '<span class="vault-detail-photo-empty">No front photo available</span>';
  return `<div class="vault-photo-flipper"><div class="vault-photo-face">${image(front, 'Front')}</div><div class="vault-photo-face vault-photo-back">${image(card.backImage, 'Back')}</div></div>`;
}

export function vaultPhoto(card) {
  const hasFront = Boolean(card.referenceImage || card.frontImage);
  const disabled = !hasFront || !card.backImage ? ' disabled' : '';
  const flip = `<button class="vault-photo-flip" type="button" aria-label="Show back image" title="Switch image"${disabled}>${flipIcon}</button>`;
  const cert = normalizeCert(card.certNumber);
  return `<div class="vault-detail-photo">${faces(card)}${flip}<div class="vault-photo-actions">${hasFront ? `<button class="vault-photo-preview" type="button">${searchIcon}Preview</button>` : ''}${cert ? `<a class="vault-photo-cert" href="${escapeHTML(certificatePath(cert))}">View Cert</a>` : ''}</div></div>
    <dialog class="vault-photo-dialog" aria-label="Card image preview"><div class="vault-photo-toolbar">${flip}<button class="vault-photo-close" type="button" aria-label="Close preview">×</button></div><div class="vault-photo-stage"><div class="vault-photo-view">${faces(card, true)}<span class="cert-zoom" aria-hidden="true"></span></div></div></dialog>`;
}

export function initializeVaultPhoto(panel) {
  const dialog = panel.querySelector('.vault-photo-dialog');
  if (!dialog) return;
  const frame = dialog.querySelector('.vault-photo-view');
  const zoom = frame.querySelector('.cert-zoom');
  const flips = panel.querySelectorAll('.vault-photo-flip');
  let back = false;
  function update() {
    panel.querySelectorAll('.vault-photo-flipper').forEach(item => item.classList.toggle('is-back', back));
    flips.forEach(button => button.setAttribute('aria-label', `Show ${back ? 'front' : 'back'} image`));
    const image = frame.querySelector(back ? '.vault-photo-back img' : '.vault-photo-face img');
    if (image) {
      zoom.style.backgroundImage = `url(${JSON.stringify(image.src)})`;
      if (image.naturalWidth) frame.style.setProperty('--image-ratio', image.naturalWidth / image.naturalHeight);
    }
  }
  panel.querySelectorAll('.vault-photo-face img').forEach(image => {
    image.addEventListener('error', () => {
      if (image.dataset.fallback) { image.src = image.dataset.fallback; image.dataset.fallback = ''; }
      else if (image.closest('.vault-photo-back')) flips.forEach(button => { button.disabled = true; });
    });
  });
  frame.querySelectorAll('img').forEach(image => {
    const size = () => frame.style.setProperty('--image-ratio', image.naturalWidth / image.naturalHeight);
    image.addEventListener('load', () => { if (image === frame.querySelector(back ? '.vault-photo-back img' : '.vault-photo-face img')) size(); });
  });
  flips.forEach(button => button.addEventListener('click', () => { back = !back; update(); }));
  const preview = panel.querySelector('.vault-photo-preview');
  preview?.addEventListener('click', () => { update(); dialog.showModal(); });
  dialog.querySelector('.vault-photo-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => preview?.focus());
  initializeImageZoom(frame, {getBoundingClientRect: () => frame.getBoundingClientRect()}, zoom);
}
