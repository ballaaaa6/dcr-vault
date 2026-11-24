import lottie from 'lottie-web/build/player/lottie_light';
import original from './scanner-original.json';

const red = [200 / 255, 16 / 255, 46 / 255];

function tintAnimation() {
  const data = structuredClone(original);
  data.layers = data.layers.filter(layer => layer.nm !== 'White Solid 1');
  const colorShapes = (value, dots = false) => {
    if (Array.isArray(value)) { value.forEach(item => colorShapes(item, dots)); return; }
    if (!value || typeof value !== 'object') return;
    if (value.ty === 'fl' || value.ty === 'st') {
      const mix = dots ? 0.15 + Math.random() * 0.45 : 0;
      const color = red.map(component => component + (1 - component) * mix);
      if (dots && value.ty === 'fl') {
        const alternate = red.map(component => component + (1 - component) * (0.15 + Math.random() * 0.45));
        value.c = {a: 1, k: [
          {t: 0, s: [...color, 1], e: [...alternate, 1], i: {x: [0.5], y: [1]}, o: {x: [0.5], y: [0]}},
          {t: 30, s: [...alternate, 1], e: [...color, 1], i: {x: [0.5], y: [1]}, o: {x: [0.5], y: [0]}},
          {t: 60, s: [...color, 1]}
        ]};
      } else value.c.k = color;
    }
    if (value.ty === 'gf') {
      const stops = value.g.k.k;
      for (let index = 0; index < value.g.p; index++) stops.splice(index * 4 + 1, 3, ...red);
    }
    Object.values(value).forEach(item => colorShapes(item, dots));
  };
  data.layers.forEach(layer => colorShapes(layer));
  data.assets.forEach(asset => colorShapes(asset, true));
  return data;
}

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
  const animation = lottie.loadAnimation({container, renderer: 'svg', loop: true, autoplay: true, animationData: tintAnimation(), rendererSettings: {preserveAspectRatio: 'none'}});
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
