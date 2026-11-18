export function json(data, status = 200, headers = {}) {
  return Response.json(data, {status, headers: {'Cache-Control': 'no-store', ...headers}});
}

export function error(message, status = 400) {
  return json({error: message}, status);
}

export function requireDatabase(env) {
  return env.DB ? null : error('Database is not configured.', 503);
}

export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function readJson(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) return null;
  try { return await request.json(); } catch { return null; }
}

export function cookieValue(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  const part = cookies.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  if (!part) return '';
  try { return decodeURIComponent(part.slice(name.length + 1)); }
  catch { return ''; }
}

export function cookie(name, value, request, maxAge, httpOnly = true) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const httpOnlyFlag = httpOnly ? '; HttpOnly' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${httpOnlyFlag}${secure}`;
}
