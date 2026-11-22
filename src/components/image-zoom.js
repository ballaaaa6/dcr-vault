export function initializeImageZoom(frame, image, zoom) {
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
}
