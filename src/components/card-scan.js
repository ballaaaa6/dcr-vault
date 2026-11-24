const duration = 1800;

function imageBounds(image, canvas) {
  const frame = canvas.getBoundingClientRect();
  const box = image.getBoundingClientRect();
  const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  return {x: box.left - frame.left + (box.width - width) / 2, y: box.top - frame.top + (box.height - height) / 2, width, height};
}

function drawScan(canvas, image, progress, opacity, points, time) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const bounds = imageBounds(image, canvas);
  const y = bounds.y + progress * bounds.height;
  context.globalAlpha = opacity;
  const red = getComputedStyle(canvas).getPropertyValue('--dcr-red').trim();
  context.fillStyle = red;
  context.fillRect(bounds.x, y - 1, bounds.width, 2);
  points.forEach(point => {
    const distance = (point.offset + time / 4200) % 1;
    const py = y - distance * bounds.height * 0.45;
    if (py < bounds.y || py > bounds.y + bounds.height) return;
    const mix = Math.round(35 + 45 * (0.5 + 0.5 * Math.sin(time / 1500 + point.phase)));
    context.fillStyle = `color-mix(in srgb, ${red} ${100 - mix}%, white)`;
    context.globalAlpha = opacity * (1 - distance) * 0.85;
    context.beginPath();
    context.arc(bounds.x + point.x * bounds.width, py, point.radius, 0, Math.PI * 2);
    context.fill();
  });
}

export function startCardScan() {
  const image = document.querySelector('[data-image-preview="front"] img');
  if (!image || !image.naturalWidth) return () => {};
  const canvas = document.createElement('canvas');
  canvas.className = 'card-scan';
  canvas.setAttribute('aria-hidden', 'true');
  image.parentElement.append(canvas);
  const points = Array.from({length: 25}, () => ({x: Math.random(), offset: Math.random(), phase: Math.random() * 6.28, radius: 1 + Math.random() * 2}));
  let started;
  let finishing = false;
  let finishAt = 0;
  let fadeStart = 0;
  function frame(time) {
    if (!canvas.isConnected || !image.isConnected) { canvas.remove(); return; }
    started ??= time;
    const elapsed = time - started;
    const cycle = elapsed % (duration * 2);
    const progress = cycle <= duration ? cycle / duration : 2 - cycle / duration;
    const opacity = finishing ? Math.max(0, (finishAt - time) / (finishAt - fadeStart)) : 1;
    drawScan(canvas, image, progress, opacity, points, elapsed);
    if (finishing && time >= finishAt) { canvas.remove(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => {
    if (finishing) return;
    if (started === undefined || matchMedia('(prefers-reduced-motion: reduce)').matches) { canvas.remove(); return; }
    fadeStart = performance.now();
    const remainder = (fadeStart - started) % duration;
    finishAt = fadeStart + (duration - remainder);
    finishing = true;
  };
}
