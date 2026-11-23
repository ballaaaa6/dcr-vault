const pendingDecodes = new WeakMap();

function updateImage(image) {
  const hasSource = Boolean(image.getAttribute('src') || image.getAttribute('srcset'));
  if (!hasSource || (image.complete && !image.naturalWidth)) {
    pendingDecodes.delete(image);
    image.classList.remove('image-loading');
    return;
  }
  if (!image.complete) {
    pendingDecodes.delete(image);
    image.classList.add('image-loading');
    return;
  }
  if (!image.classList.contains('image-loading')) return;
  if (typeof image.decode !== 'function') { image.classList.remove('image-loading'); return; }
  if (pendingDecodes.has(image)) return;
  const source = image.currentSrc || image.src;
  const token = {};
  pendingDecodes.set(image, token);
  image.decode().catch(() => {}).then(() => {
    if (pendingDecodes.get(image) !== token) return;
    pendingDecodes.delete(image);
    if (image.complete && (image.currentSrc || image.src) === source) image.classList.remove('image-loading');
    else updateImage(image);
  });
}

export function initializeImageLoading(root = document) {
  const scan = node => {
    if (node.nodeType !== 1) return;
    if (node.matches('img')) updateImage(node);
    node.querySelectorAll('img').forEach(updateImage);
  };
  root.addEventListener('load', event => {
    if (event.target.matches?.('img')) updateImage(event.target);
  }, true);
  root.addEventListener('error', event => {
    if (event.target.matches?.('img')) queueMicrotask(() => updateImage(event.target));
  }, true);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') updateImage(record.target);
      else record.addedNodes.forEach(scan);
    }
  });
  observer.observe(root.documentElement || root, {subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset']});
  root.querySelectorAll('img').forEach(updateImage);
  return () => observer.disconnect();
}
