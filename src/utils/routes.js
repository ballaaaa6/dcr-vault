export function nextRoute(search) {
  const value = new URLSearchParams(search).get('next') || '';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/vault';
  if (value.startsWith('/login') || value.startsWith('/import')) return '/vault';
  return value;
}
