export function initializeCrop(save, photoStatus) {
  const dialog = document.querySelector('.profile-crop-dialog');
  const file = document.querySelector('#crop-file');
  const area = dialog.querySelector('.profile-crop-area');
  const image = area.querySelector('img');
  const button = dialog.querySelector('[data-crop-save]');
  const status = dialog.querySelector('.profile-crop-status');
  let bitmap, x = 0, y = 0, scale = 1, drag;
  const position = () => {
    const size = area.clientWidth;
    scale = Math.max(size / bitmap.width, size / bitmap.height);
    const width = bitmap.width * scale, height = bitmap.height * scale;
    x = Math.min(0, Math.max(size - width, x)); y = Math.min(0, Math.max(size - height, y));
    image.style.width = `${width}px`; image.style.height = `${height}px`;
    image.style.transform = `translate(${x}px, ${y}px)`;
  };
  const reset = () => { if (bitmap) bitmap.close(); bitmap = null; file.value = ''; area.hidden = true; button.disabled = true; status.textContent = ''; };
  file.onclick = () => { reset(); photoStatus.textContent = ''; };
  dialog.querySelectorAll('[data-crop-close]').forEach(close => close.onclick = () => dialog.close());
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
  dialog.onclose = reset;
  file.onchange = async () => {
    const selected = file.files[0]; if (!selected) return;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP photo under 5 MB.');
      const next = await createImageBitmap(selected); if (bitmap) bitmap.close(); bitmap = next;
      image.src = URL.createObjectURL(selected); image.onload = () => URL.revokeObjectURL(image.src);
      area.hidden = false; dialog.showModal(); x = 0; y = 0; position(); x = (area.clientWidth - bitmap.width * scale) / 2; y = (area.clientWidth - bitmap.height * scale) / 2; position();
      button.disabled = false; status.textContent = '';
    } catch (error) { reset(); photoStatus.textContent = error.message; }
  };
  area.onpointerdown = event => { drag = {x: event.clientX, y: event.clientY}; area.setPointerCapture(event.pointerId); };
  area.onpointermove = event => { if (!drag) return; x += event.clientX - drag.x; y += event.clientY - drag.y; drag = {x: event.clientX, y: event.clientY}; position(); };
  area.onpointerup = area.onpointercancel = () => { drag = null; };
  button.onclick = async () => {
    button.disabled = true; status.textContent = 'Saving…';
    try {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 256, 256);
      const factor = 256 / area.clientWidth;
      context.drawImage(bitmap, x * factor, y * factor, bitmap.width * scale * factor, bitmap.height * scale * factor);
      await save({avatarUrl: canvas.toDataURL('image/jpeg', 0.8)}); photoStatus.textContent = 'Photo saved.'; dialog.close();
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  };
}
