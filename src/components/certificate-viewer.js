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

export function initializeCertificateViewer() {
  const gallery = document.querySelector('.cert-gallery');
  const dialog = document.querySelector('.cert-viewer');
  if (!gallery || !dialog) return;
  const buttons = [...gallery.querySelectorAll('.cert-image')];
  const image = dialog.querySelector('.cert-viewer-image img');
  const frame = dialog.querySelector('.cert-viewer-image');
  const zoom = dialog.querySelector('.cert-zoom');
  const thumbs = dialog.querySelector('.cert-viewer-thumbs');
  const label = dialog.querySelector('[data-viewer-label]');
  const status = dialog.querySelector('.cert-viewer-download-status');
  image.addEventListener('load', () => {
    image.style.setProperty('--image-ratio', image.naturalWidth / image.naturalHeight);
  });
  let opener;
  let selectedSide = 'front';
  function select(button) {
    const source = button.querySelector('img');
    selectedSide = button.dataset.side;
    image.src = source.src;
    image.alt = source.alt;
    label.textContent = button.querySelector('span').textContent;
    status.textContent = '';
    zoom.style.backgroundImage = `url(${JSON.stringify(source.src)})`;
    thumbs.querySelectorAll('button').forEach((item, index) => item.setAttribute('aria-pressed', String(buttons[index] === button)));
    frame.classList.remove('is-zoomed');
  }
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
    thumbs.append(thumb);
    source.addEventListener('error', hideFailedImage);
    if (source.complete && !source.naturalWidth) hideFailedImage();
    thumb.addEventListener('click', () => select(button));
    button.addEventListener('click', () => { opener = button; select(button); dialog.showModal(); });
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
