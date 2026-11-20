export function httpsHostnameOrigin(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  let url;
  try { url = new URL(input); } catch { return ''; }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const labels = hostname.split('.');
  const validHostname = labels.length > 1
    && labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  const ipLiteral = hostname.includes(':') || /^\d+(?:\.\d+){0,3}$/.test(hostname);
  if (url.protocol !== 'https:' || !validHostname || ipLiteral || url.port
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
  return url.origin;
}
