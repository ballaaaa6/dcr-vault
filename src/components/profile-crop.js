function jpeg(width, height, draw, quality = 0.8) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
  draw(context);
  return canvas.toDataURL('image/jpeg', quality);
}

export function initializeCrop(save, photoStatus) {
  const dialog = document.querySelector('.profile-crop-dialog[aria-labelledby="crop-title"]');
  const file = document.querySelector('#crop-file');
  const area = dialog.querySelector('.profile-crop-area');
  const image = area.querySelector('img');
  const zoom = dialog.querySelector('#profile-photo-zoom');
  const button = dialog.querySelector('[data-crop-save]');
  const status = dialog.querySelector('.profile-crop-status');
  let bitmap, x = 0, y = 0, scale = 1, drag;
  const position = () => {
    const size = area.clientWidth;
    const width = bitmap.width * scale, height = bitmap.height * scale;
    x = Math.min(0, Math.max(size - width, x)); y = Math.min(0, Math.max(size - height, y));
    image.style.width = `${width}px`; image.style.height = `${height}px`;
    image.style.transform = `translate(${x}px, ${y}px)`;
  };
  const reset = () => { if (bitmap) bitmap.close(); bitmap = null; drag = null; file.value = ''; area.hidden = true; button.disabled = true; status.textContent = ''; };
  file.onclick = () => { reset(); photoStatus.textContent = ''; };
  dialog.querySelectorAll('[data-crop-close]').forEach(close => close.onclick = () => dialog.close());
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
  dialog.onclose = reset;
  file.onchange = async () => {
    const selected = file.files[0]; if (!selected) return;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP photo under 5 MB.');
      bitmap = await createImageBitmap(selected);
      image.src = URL.createObjectURL(selected); image.onload = () => URL.revokeObjectURL(image.src);
      area.hidden = false; dialog.showModal(); zoom.value = '1';
      scale = Math.max(area.clientWidth / bitmap.width, area.clientWidth / bitmap.height);
      x = (area.clientWidth - bitmap.width * scale) / 2; y = (area.clientWidth - bitmap.height * scale) / 2;
      position(); button.disabled = false; status.textContent = '';
    } catch (error) { reset(); photoStatus.textContent = error.message; }
  };
  zoom.oninput = () => {
    if (!bitmap) return;
    const size = area.clientWidth, previous = scale;
    scale = Math.max(size / bitmap.width, size / bitmap.height) * Math.max(1, Number(zoom.value));
    x = size / 2 - (size / 2 - x) * scale / previous; y = size / 2 - (size / 2 - y) * scale / previous;
    position();
  };
  area.onpointerdown = event => { drag = {x: event.clientX, y: event.clientY}; area.setPointerCapture(event.pointerId); };
  area.onpointermove = event => { if (!drag) return; x += event.clientX - drag.x; y += event.clientY - drag.y; drag = {x: event.clientX, y: event.clientY}; position(); };
  area.onpointerup = area.onpointercancel = () => { drag = null; };
  button.onclick = async () => {
    button.disabled = true; status.textContent = 'Saving…';
    try {
      const factor = 256 / area.clientWidth;
      const avatarUrl = jpeg(256, 256, context => context.drawImage(bitmap, x * factor, y * factor, bitmap.width * scale * factor, bitmap.height * scale * factor));
      const fullScale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * fullScale)), height = Math.max(1, Math.round(bitmap.height * fullScale));
      let avatarFullUrl = jpeg(width, height, context => context.drawImage(bitmap, 0, 0, width, height));
      if (avatarFullUrl.length > 180000) avatarFullUrl = jpeg(width, height, context => context.drawImage(bitmap, 0, 0, width, height), 0.5);
      if (avatarFullUrl.length > 180000) {
        const smallWidth = Math.max(1, Math.round(width / 2)), smallHeight = Math.max(1, Math.round(height / 2));
        avatarFullUrl = jpeg(smallWidth, smallHeight, context => context.drawImage(bitmap, 0, 0, smallWidth, smallHeight));
      }
      await save({avatarUrl, avatarFullUrl}); photoStatus.textContent = 'Photo saved.'; dialog.close();
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  };
}
