export function nextRoute(search) {
  const raw = new URLSearchParams(search).get('next') || '';
  const value = raw.startsWith('#/') ? raw.slice(1) : raw;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/vault';
  if (value.startsWith('/login') || value.startsWith('/import')) return '/vault';
  return value;
}

export function legacyRoute(hash) {
  return hash.startsWith('#/') && !hash.startsWith('#//') && !hash.includes('\\') ? hash.slice(1) : null;
}
