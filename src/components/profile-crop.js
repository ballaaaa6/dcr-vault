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
  const button = dialog.querySelector('[data-crop-save]');
  const status = dialog.querySelector('.profile-crop-status');
  let bitmap, x = 0, y = 0, scale = 1;
  const pointers = new Map();
  const position = () => {
    const size = area.clientWidth;
    const width = bitmap.width * scale, height = bitmap.height * scale;
    x = Math.min(0, Math.max(size - width, x)); y = Math.min(0, Math.max(size - height, y));
    image.style.width = `${width}px`; image.style.height = `${height}px`;
    image.style.transform = `translate(${x}px, ${y}px)`;
  };
  const reset = () => { if (bitmap) bitmap.close(); bitmap = null; pointers.clear(); file.value = ''; area.hidden = true; button.disabled = true; status.textContent = ''; };
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
      area.hidden = false; dialog.showModal();
      scale = Math.max(area.clientWidth / bitmap.width, area.clientWidth / bitmap.height);
      x = (area.clientWidth - bitmap.width * scale) / 2; y = (area.clientWidth - bitmap.height * scale) / 2;
      position(); button.disabled = false; status.textContent = '';
    } catch (error) { reset(); photoStatus.textContent = error.message; }
  };
  const zoomAt = (factor, centerX, centerY) => {
    if (!bitmap) return;
    const size = area.clientWidth, previous = scale;
    const minimum = Math.max(size / bitmap.width, size / bitmap.height);
    scale = Math.min(minimum * 3, Math.max(minimum, scale * factor));
    x = centerX - (centerX - x) * scale / previous;
    y = centerY - (centerY - y) * scale / previous;
    position();
  };
  const relative = point => { const rect = area.getBoundingClientRect(); return {x: point.x - rect.left, y: point.y - rect.top}; };
  const midpoint = points => ({x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2});
  const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  area.addEventListener('wheel', event => {
    if (!bitmap) return;
    event.preventDefault();
    const point = relative({x: event.clientX, y: event.clientY});
    zoomAt(Math.exp(-event.deltaY * 0.001), point.x, point.y);
  }, {passive: false});
  area.onkeydown = event => {
    if (!['+', '=', '-', '_'].includes(event.key)) return;
    event.preventDefault(); zoomAt(event.key === '+' || event.key === '=' ? 1.1 : 1 / 1.1, area.clientWidth / 2, area.clientWidth / 2);
  };
  area.onpointerdown = event => {
    if (pointers.size >= 2) return;
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY}); area.setPointerCapture(event.pointerId);
  };
  area.onpointermove = event => {
    if (!pointers.has(event.pointerId)) return;
    const before = [...pointers.values()];
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    const after = [...pointers.values()];
    if (after.length === 1) { x += after[0].x - before[0].x; y += after[0].y - before[0].y; position(); return; }
    const oldCenter = midpoint(before), newCenter = midpoint(after), center = relative(oldCenter);
    if (distance(before)) zoomAt(distance(after) / distance(before), center.x, center.y);
    x += newCenter.x - oldCenter.x; y += newCenter.y - oldCenter.y; position();
  };
  area.onpointerup = area.onpointercancel = event => { pointers.delete(event.pointerId); };
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
