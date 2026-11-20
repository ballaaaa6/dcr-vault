import {tokenHash} from './sessions.js';
import {httpsHostnameOrigin} from './origin.js';

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function supportedImageType(value) {
  const type = String(value || '').split(';', 1)[0].trim().toLowerCase();
  return IMAGE_TYPES.has(type) ? type : '';
}

function randomCapability() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function createImageCapability(db, details) {
  const token = randomCapability();
  const now = Math.floor(Date.now() / 1000);
  await db.prepare('DELETE FROM image_capabilities WHERE expires_at <= ? OR used_at IS NOT NULL AND created_at < ?')
    .bind(now, now - 600).run();
  await db.prepare(`INSERT INTO image_capabilities
    (token_hash, user_id, card_id, side, operation, content_type, object_key, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(await tokenHash(token), details.userId, details.cardId, details.side, details.operation,
      details.contentType || '', details.objectKey || '', now, now + 120).run();
  return token;
}

export async function readImageBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > IMAGE_MAX_BYTES) return {error: 'Each photo must be 10 MB or smaller.'};
  if (!request.body) return {error: 'Choose an image to upload.'};
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > IMAGE_MAX_BYTES) { await reader.cancel(); return {error: 'Each photo must be 10 MB or smaller.'}; }
    chunks.push(value);
  }
  if (!total) return {error: 'Choose an image to upload.'};
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return {body};
}

export async function imageServiceRequest(env, path, options = {}) {
  const origin = httpsHostnameOrigin(env.ORCL_MEDIA_ORIGIN);
  if (!origin) throw new Error('Oracle image storage requires an HTTPS origin with a DNS hostname.');
  return fetch(`${origin}${path}`, {...options, redirect: 'manual', signal: AbortSignal.timeout(30000)});
}
