export function initializeCrop(save, photoStatus) {
  const dialog = document.querySelector('.profile-crop-dialog[aria-labelledby="crop-title"]');
  const file = document.querySelector('#crop-file');
  const area = dialog.querySelector('.profile-crop-area');
  const image = area.querySelector('img');
  const button = dialog.querySelector('[data-crop-save]');
  const status = dialog.querySelector('.profile-crop-status');
  let bitmap;
  const reset = () => { if (bitmap) bitmap.close(); bitmap = null; file.value = ''; area.hidden = true; button.disabled = true; status.textContent = ''; };
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
      area.hidden = false; dialog.showModal(); button.disabled = false; status.textContent = '';
    } catch (error) { reset(); photoStatus.textContent = error.message; }
  };
  button.onclick = async () => {
    button.disabled = true; status.textContent = 'Saving…';
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      await save({avatarUrl: canvas.toDataURL('image/jpeg', 0.8)}); photoStatus.textContent = 'Photo saved.'; dialog.close();
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  };
}
