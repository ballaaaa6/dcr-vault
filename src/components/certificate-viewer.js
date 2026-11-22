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
  let opener;
  function select(button) {
    const source = button.querySelector('img');
    image.src = source.src;
    image.alt = source.alt;
    label.textContent = button.querySelector('span').textContent;
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
  dialog.querySelector('[data-viewer-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { frame.classList.remove('is-zoomed'); opener?.focus(); });
  frame.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const rect = image.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    zoom.style.backgroundSize = `${rect.width * 2.5}px ${rect.height * 2.5}px`;
    zoom.style.backgroundPosition = `${90 - x * rect.width * 2.5}px ${90 - y * rect.height * 2.5}px`;
    zoom.style.setProperty('--lens-x', `${x * 100}%`);
    zoom.style.setProperty('--lens-y', `${y * 100}%`);
  });
  frame.addEventListener('click', () => frame.classList.toggle('is-zoomed'));
}
