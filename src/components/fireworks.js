const palettes = [
  ['#D50032', '#E8AD00'], ['#F03A17', '#1678DA'], ['#008D70', '#EF3175'],
  ['#E91361', '#008DB5'], ['#DF3044', '#008A9C'], ['#3378DD', '#E3286E'],
  ['#A97800', '#6042B0']
];

function paint(value, color) {
  if (Array.isArray(value)) { value.forEach(item => paint(item, color)); return; }
  if (!value || typeof value !== 'object') return;
  if ((value.ty === 'fl' || value.ty === 'st') && Array.isArray(value.c?.k) && typeof value.c.k[0] === 'number') {
    value.c.k = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255).concat(1);
  }
  Object.values(value).forEach(item => paint(item, color));
}

export async function prepareFireworks() {
  const [{default: lottie}, response] = await Promise.all([
    import('lottie-web/build/player/lottie_light'), fetch('/assets/celebrations/line-fireworks.json')
  ]);
  if (!response.ok) throw new Error('Fireworks unavailable');
  const original = await response.json();
  return container => {
    const animationData = structuredClone(original);
    const palette = palettes[Math.floor(Math.random() * palettes.length)];
    animationData.layers.forEach((layer, index) => {
      const secondary = ['Sparks', 'Inner rays', 'Trail'].includes(layer.nm) ? 1 : 0;
      paint(layer, palette[secondary ^ (Math.floor(index / 6) % 2)]);
    });
    return lottie.loadAnimation({container, renderer: 'svg', loop: false, autoplay: true, animationData});
  };
}
