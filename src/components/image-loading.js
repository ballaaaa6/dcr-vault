function updateImage(image) {
  const hasSource = Boolean(image.getAttribute('src') || image.getAttribute('srcset'));
  image.classList.toggle('image-loading', hasSource && !image.complete);
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
