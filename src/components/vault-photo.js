import {switchIcon} from './action-icons.js';
import {cornerSwitchIcon, animateCornerSwitch} from './corner-switch.js';
import {availableCorners} from '../utils/card-corners.js';
import {escapeHTML} from '../utils/format.js';
import {certificatePath, normalizeCert} from '../utils/cert.js';
import {initializeImageZoom} from './image-zoom.js';
import {cardImageVariant} from '../utils/card-image-variant.js';

const searchIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>';

function faceImage(card, url, label, isDialog = false) {
  if (!url) return '<span class="vault-detail-photo-empty">No front photo available</span>';
  return `<img src="${escapeHTML(isDialog ? url : cardImageVariant(url, 'medium'))}" alt="${escapeHTML(card.name)} — ${escapeHTML(label)}" referrerpolicy="no-referrer"${isDialog || label === 'Back' ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async">`;
}

function faces(card, isDialog = false) {
  return `<div class="vault-photo-flipper"><div class="vault-photo-face">${faceImage(card, card.frontImage, 'Front', isDialog)}</div><div class="vault-photo-face vault-photo-back" aria-hidden="true">${faceImage(card, card.backImage, 'Back', isDialog)}</div></div>`;
}

export function vaultPhoto(card) {
  const hasFront = Boolean(card.frontImage);
  const disabled = !hasFront || !card.backImage ? ' disabled' : '';
  const flip = `<button class="vault-photo-flip" type="button" aria-label="Show back image"${disabled}>${switchIcon()}</button>`;
  const corners = availableCorners(card);
  const cornerData = escapeHTML(JSON.stringify({name: card.name, front: card.frontImage || '', back: card.backImage || '', corners}));
  const cornerButton = `<button class="corner-switch vault-corner-switch" type="button" aria-label="Show back corner image"${corners.length ? '' : ' disabled'}>${cornerSwitchIcon()}</button>`;
  const cert = normalizeCert(card.certNumber);
  return `<div class="vault-photo-data" data-images="${cornerData}" hidden></div><div class="vault-detail-photo">${faces(card)}<div class="vault-photo-actions">${hasFront ? `<button class="vault-photo-preview" type="button">${searchIcon}Preview</button>` : ''}${cert ? `<a class="vault-photo-cert" href="${escapeHTML(certificatePath(cert))}" target="_blank" rel="noopener noreferrer">View Cert</a>` : ''}</div></div>${flip}${cornerButton}
    <dialog class="vault-photo-dialog" aria-label="Card image preview"><div class="vault-photo-toolbar"><button class="dialog-close vault-photo-close" type="button" aria-label="Close preview">×</button>${flip}${cornerButton}</div><div class="vault-photo-stage"><div class="vault-photo-view">${faces(card, true)}<span class="cert-zoom" aria-hidden="true"></span></div></div></dialog>`;
}

function setFace(face, data, selection, original) {
  const url = selection.url;
  if (!url) { face.innerHTML = '<span class="vault-detail-photo-empty">No front photo available</span>'; return; }
  const image = document.createElement('img');
  if (original) image.loading = 'lazy';
  image.src = original ? url : cardImageVariant(url, 'medium');
  image.alt = `${data.name} — ${selection.label}`;
  image.referrerPolicy = 'no-referrer';
  image.decoding = 'async';
  face.replaceChildren(image);
}

export function initializeVaultPhoto(panel) {
  const dialog = panel.querySelector('.vault-photo-dialog');
  if (!dialog) return;
  const data = JSON.parse(panel.querySelector('.vault-photo-data').dataset.images);
  const frame = dialog.querySelector('.vault-photo-view');
  const zoom = frame.querySelector('.cert-zoom');
  const flips = panel.querySelectorAll('.vault-photo-flip');
  const corners = panel.querySelectorAll('.vault-corner-switch');
  let selected = {side: 'front', label: 'Front', url: data.front};
  let faceBack = false;
  function watchBackImage(image) {
    image?.addEventListener('error', () => flips.forEach(button => { button.disabled = true; }), {once: true});
  }
  panel.querySelectorAll('.vault-photo-back img').forEach(watchBackImage);
  function update(selection) {
    selected = selection;
    faceBack = !faceBack;
    panel.querySelectorAll('.vault-photo-flipper').forEach(flipper => {
      const face = flipper.querySelector(faceBack ? '.vault-photo-back' : '.vault-photo-face:not(.vault-photo-back)');
      setFace(face, data, selected, Boolean(flipper.closest('dialog')));
      if (selected.side === 'back') watchBackImage(face.querySelector('img'));
      flipper.querySelectorAll('.vault-photo-face').forEach(item => item.setAttribute('aria-hidden', String(item !== face)));
      flipper.classList.toggle('is-back', faceBack);
    });
    flips.forEach(button => button.setAttribute('aria-label', `Show ${selected.side === 'front' ? 'back' : 'front'} image`));
    const image = frame.querySelector(faceBack ? '.vault-photo-back img' : '.vault-photo-face:not(.vault-photo-back) img');
    if (image) {
      zoom.style.backgroundImage = `url(${JSON.stringify(image.src)})`;
      const size = () => { if (image.isConnected && image.closest('.vault-photo-face')?.getAttribute('aria-hidden') === 'false' && image.naturalWidth) dialog.style.setProperty('--image-ratio', image.naturalWidth / image.naturalHeight); };
      image.addEventListener('load', size, {once: true}); size();
    } else zoom.style.backgroundImage = '';
  }
  flips.forEach(button => button.addEventListener('click', () => {
    const back = selected.side === 'front';
    update({side: back ? 'back' : 'front', label: back ? 'Back' : 'Front', url: back ? data.back : data.front});
  }));
  corners.forEach(button => button.addEventListener('click', () => {
    const index = data.corners.findIndex(corner => corner.side === selected.side);
    update(index >= 0 && index + 1 === data.corners.length ? {side: 'front', label: 'Front', url: data.front} : data.corners[index + 1]);
    animateCornerSwitch(button);
  }));
  const preview = panel.querySelector('.vault-photo-preview');
  preview?.addEventListener('click', () => {
    const image = frame.querySelector(faceBack ? '.vault-photo-back img' : '.vault-photo-face:not(.vault-photo-back) img');
    if (image) { zoom.style.backgroundImage = `url(${JSON.stringify(image.src)})`; if (image.naturalWidth) dialog.style.setProperty('--image-ratio', image.naturalWidth / image.naturalHeight); }
    dialog.showModal();
  });
  dialog.querySelector('.vault-photo-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => preview?.focus());
  initializeImageZoom(frame, {getBoundingClientRect: () => frame.getBoundingClientRect()}, zoom);
}
