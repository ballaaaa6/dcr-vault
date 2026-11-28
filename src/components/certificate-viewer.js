import {initializeImageZoom} from './image-zoom.js';

async function downloadImage(url, cert, side) {
  const response = await fetch(url, {referrerPolicy: 'no-referrer'});
  if (!response.ok) throw new Error('Image download failed');
  const blob = await response.blob();
  const extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'}[blob.type] || 'img';
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${cert}-${side}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function initializeThumbnails(buttons, gallery, thumbs, cornerThumbs, select, open) {
  buttons.forEach(button => {
    const source = button.querySelector('img');
    const hideFailedImage = () => {
      button.hidden = true;
      thumb.hidden = true;
      if (buttons.every(item => item.hidden)) gallery.hidden = true;
    };
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.setAttribute('aria-label', `Show ${button.querySelector('span').textContent}`);
    const preview = source.cloneNode();
    preview.alt = '';
    thumb.append(preview);
    (button.dataset.side.startsWith('back-') ? cornerThumbs : thumbs).append(thumb);
    thumb.dataset.side = button.dataset.side;
    source.addEventListener('error', hideFailedImage);
    if (source.complete && !source.naturalWidth) hideFailedImage();
    thumb.addEventListener('click', () => select(button));
    button.addEventListener('click', () => open(button));
  });
}

function imageDimensions(source) {
  if (source.complete) return Promise.resolve(source);
  return new Promise(resolve => {
    source.addEventListener('load', () => resolve(source), {once: true});
    source.addEventListener('error', () => resolve(source), {once: true});
  });
}

export function initializeCertificateViewer() {
  const gallery = document.querySelector('.cert-gallery');
  const dialog = document.querySelector('.cert-viewer');
  if (!gallery || !dialog) return;
  const buttons = [...gallery.querySelectorAll('.cert-image')];
  const image = dialog.querySelector('.cert-viewer-image img');
  const frame = dialog.querySelector('.cert-viewer-image');
  const zoom = dialog.querySelector('.cert-zoom');
  const thumbs = dialog.querySelector('.cert-viewer-thumbs');
  const cornerThumbs = dialog.querySelector('.cert-viewer-corners');
  const label = dialog.querySelector('[data-viewer-label]');
  const status = dialog.querySelector('.cert-viewer-download-status');
  const dimensions = Promise.all(buttons.map(button => imageDimensions(button.querySelector('img'))));
  let opening = false;
  let opener;
  let selectedSide = 'front';
  function select(button) {
    const source = button.querySelector('img');
    selectedSide = button.dataset.side;
    frame.style.setProperty('--selected-ratio', source.naturalWidth / source.naturalHeight || .7);
    image.src = source.dataset.original || source.src;
    image.alt = source.alt;
    label.textContent = button.querySelector('span').textContent;
    status.textContent = '';
    zoom.style.backgroundImage = `url(${JSON.stringify(image.src)})`;
    dialog.querySelectorAll('.cert-viewer-thumbs button').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.side === button.dataset.side)));
    frame.classList.remove('is-zoomed');
  }
  initializeThumbnails(buttons, gallery, thumbs, cornerThumbs, select, async button => {
    if (opening || dialog.open) return;
    opening = true;
    const sources = await dimensions;
    const ratios = sources.filter(source => source.naturalWidth && source.naturalHeight).map(source => source.naturalWidth / source.naturalHeight);
    dialog.style.setProperty('--image-ratio', (ratios.length ? Math.max(...ratios) : .7));
    opener = button;
    select(button);
    dialog.showModal();
    opening = false;
  });
  dialog.querySelector('[data-viewer-download]').addEventListener('click', async () => {
    status.textContent = '';
    try {
      await downloadImage(image.src, dialog.dataset.cert, selectedSide);
    } catch {
      status.textContent = 'Unable to download this image. Please try again.';
    }
  });
  dialog.querySelector('[data-viewer-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { frame.classList.remove('is-zoomed'); opener?.focus(); });
  initializeImageZoom(frame, image, zoom);
  frame.addEventListener('click', () => frame.classList.toggle('is-zoomed'));
}
