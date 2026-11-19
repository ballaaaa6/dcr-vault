const LANGUAGES = new Set(['en', 'th', 'ja', 'ko', 'zh-tw', 'zh-cn']);
const PART = /^[a-z0-9][a-z0-9.-]{0,59}$/i;

function validPart(value) {
  return PART.test(String(value || ''));
}

function notFound() {
  return new Response(null, {status: 404, headers: {'Cache-Control': 'public, max-age=300'}});
}

export async function onRequestGet({request}) {
  const query = new URL(request.url).searchParams;
  const language = query.get('language') || '';
  const series = query.get('series') || '';
  const set = query.get('set') || '';
  const card = query.get('card') || '';
  if (!LANGUAGES.has(language) || ![series, set, card].every(validPart)) return notFound();

  const path = [language, series, set, card].map(encodeURIComponent).join('/');
  try {
    const upstream = await fetch(`https://assets.tcgdex.net/${path}/low.webp`, {headers: {Accept: 'image/webp'}});
    if (!upstream.ok) return notFound();
    return new Response(upstream.body, {headers: {
      'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      'X-Content-Type-Options': 'nosniff'
    }});
  } catch {
    return new Response(null, {status: 502, headers: {'Cache-Control': 'no-store'}});
  }
}
