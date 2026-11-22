export function cardImageVariant(url, variant) {
  if (!url || !['small', 'medium'].includes(variant) || !/^\/api\/cards\/[0-9a-f-]+\/images\/(front|back)(?:\?|$)/i.test(url)) return url || '';
  const parts = url.split('?');
  const query = new URLSearchParams(parts[1] || '');
  query.set('variant', variant);
  return `${parts[0]}?${query}`;
}
