const LIMIT = 2;
const MAX_QUEUED = 8;
const RETAINED = 20;

export function prefetchNearbyImages(root) {
  if (!root || typeof IntersectionObserver === 'undefined' || navigator.connection?.saveData) return () => {};
  const queue = [];
  const seen = new Map();
  let active = 0;
  let stopped = false;
  function next() {
    while (!stopped && active < LIMIT && queue.length) {
      const url = queue.shift();
      const image = new Image();
      image.referrerPolicy = 'no-referrer';
      image.fetchPriority = 'low';
      seen.set(url, image);
      while (seen.size > RETAINED) seen.delete(seen.keys().next().value);
      active++;
      image.onload = image.onerror = () => { active--; next(); };
      image.src = url;
    }
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const url = entry.target.dataset.prefetchImage;
      if (url && !seen.has(url) && !queue.includes(url) && queue.length < MAX_QUEUED) queue.push(url);
    }
    next();
  }, {rootMargin: '120px'});
  root.querySelectorAll('[data-prefetch-image]').forEach(row => observer.observe(row));
  return () => { stopped = true; queue.length = 0; observer.disconnect(); };
}
