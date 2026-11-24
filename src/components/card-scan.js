import lottie from 'lottie-web/build/player/lottie_light';
import original from './scanner-original.json';

import {tintScanner} from './scanner-colors.js';

function fitToPhoto(container, image, svg) {
  const frame = container.getBoundingClientRect();
  const box = image.getBoundingClientRect();
  const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  if (!width || !height || !frame.width || !frame.height) return;
  const x = box.left - frame.left + (box.width - width) / 2;
  const y = box.top - frame.top + (box.height - height) / 2;
  svg.setAttribute('viewBox', `${-x * original.w / width} ${-y * original.h / height} ${frame.width * original.w / width} ${frame.height * original.h / height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
}

export function startCardScan() {
  const image = document.querySelector('[data-image-preview="front"] img');
  if (!image?.naturalWidth) return () => {};
  const container = document.createElement('div');
  container.className = 'card-scan';
  container.setAttribute('aria-hidden', 'true');
  image.parentElement.append(container);
  const animation = lottie.loadAnimation({container, renderer: 'svg', loop: true, autoplay: true, animationData: tintScanner(structuredClone(original)), rendererSettings: {preserveAspectRatio: 'none'}});
  const observer = new ResizeObserver(() => { if (container.firstElementChild) fitToPhoto(container, image, container.firstElementChild); });
  observer.observe(container);
  observer.observe(image);
  animation.addEventListener('DOMLoaded', () => fitToPhoto(container, image, container.firstElementChild));
  let stopped = false;
  function cleanup() { observer.disconnect(); animation.destroy(); container.remove(); }
  return () => {
    if (stopped) return;
    stopped = true;
    if (!container.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) { cleanup(); return; }
    const frame = animation.currentFrame % 60;
    const remaining = (frame < 30 ? 30 - frame : 60 - frame) / original.fr * 1000;
    const start = performance.now();
    function fade(now) {
      if (!container.isConnected || now - start >= remaining) { cleanup(); return; }
      container.firstElementChild?.setAttribute('opacity', String(1 - (now - start) / remaining));
      requestAnimationFrame(fade);
    }
    requestAnimationFrame(fade);
  };
}
