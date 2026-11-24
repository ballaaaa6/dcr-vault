const red = [200 / 255, 16 / 255, 46 / 255];
const pink = [1, 232 / 255, 235 / 255];

function easedProgress(progress) {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 20; i++) {
    const t = (low + high) / 2;
    const x = 3 * (1 - t) * (1 - t) * t * 0.333 + 3 * (1 - t) * t * t * 0.333 + t ** 3;
    if (x < progress) low = t; else high = t;
  }
  const t = (low + high) / 2;
  return 3 * (1 - t) * t * t + t ** 3;
}

export function scanLinePosition(frame, height) {
  const progress = frame <= 30 ? frame / 30 : (frame - 30) / 30;
  const eased = easedProgress(Math.max(0, Math.min(1, progress)));
  return height * (frame <= 30 ? eased : 1 - eased);
}

export function scanDotColor(distance, height) {
  const mix = Math.min(1, Math.max(0, distance / height));
  return [...red.map((component, index) => component + (pink[index] - component) * mix), 1];
}

export function tintScanner(data) {
  data.layers = data.layers.filter(layer => layer.nm !== 'White Solid 1');
  const tint = value => {
    if (Array.isArray(value)) { value.forEach(tint); return; }
    if (!value || typeof value !== 'object') return;
    if (value.ty === 'fl' || value.ty === 'st') value.c.k = red;
    if (value.ty === 'gf') {
      const stops = value.g.k.k;
      for (let index = 0; index < value.g.p; index++) stops.splice(index * 4 + 1, 3, ...red);
    }
    Object.values(value).forEach(tint);
  };
  data.layers.forEach(tint);
  for (const asset of data.assets) {
    asset.layers = asset.layers.filter(layer => layer.nm !== 'Shape Layer 1' && layer.nm !== 'Shape Layer 2');
    const dots = asset.layers.find(layer => layer.nm === 'Shape Layer 3');
    if (!dots) continue;
    for (const dot of dots.shapes) {
      const fill = dot.it.find(item => item.ty === 'fl');
      const transform = dot.it.find(item => item.ty === 'tr');
      if (!fill || !transform) continue;
      const y = dots.ks.p.k[1] + transform.p.k[1];
      const colors = Array.from({length: 61}, (_, frame) => scanDotColor(Math.abs(y - scanLinePosition(frame, data.h)), data.h));
      fill.c = {a: 1, k: colors.map((color, frame) => frame === 60 ? {t: frame, s: color} : {
        t: frame, s: color, e: colors[frame + 1], i: {x: [0.667], y: [0.667]}, o: {x: [0.333], y: [0.333]}
      })};
    }
  }
  return data;
}
