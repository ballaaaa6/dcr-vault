import {error, json, sameOrigin} from '../../../../_utils/http.js';
import {currentUser} from '../../../../_utils/sessions.js';
import {createImageCapability, imageServiceRequest, IMAGE_MAX_BYTES, readImageBody, supportedImageType} from '../../../../_utils/images.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIDES = new Set(['front', 'back']);

async function scope(request, env, params, requireSameOrigin = false) {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (requireSameOrigin && (!sameOrigin(request) || fetchSite && !['same-origin', 'none'].includes(fetchSite))) {
    return {response: json({error: 'Invalid request origin.'}, 403)};
  }
  const session = await currentUser(request, env);
  if (session.response) return {response: session.response};
  const cardId = String(params.id || '');
  const side = String(params.side || '');
  if (!UUID.test(cardId) || !SIDES.has(side)) return {response: error('Card image not found.', 404)};
  const card = await env.DB.prepare('SELECT id FROM cards WHERE id = ? AND user_id = ?')
    .bind(cardId, session.user.id).first();
  return card ? {db: env.DB, userId: session.user.id, cardId, side} : {response: error('Card not found in your vault.', 404)};
}

async function capability(db, details) {
  return createImageCapability(db, details);
}

async function callImageService(env, scopeData, operation, contentType, objectKey = '', body = undefined) {
  const token = await capability(scopeData.db, {...scopeData, operation, contentType, objectKey});
  const method = operation === 'put' ? 'PUT' : operation === 'get' ? 'GET' : 'DELETE';
  const headers = {'X-DCR-Capability': token, 'X-DCR-Operation': operation, 'X-DCR-Card': scopeData.cardId, 'X-DCR-Side': scopeData.side, 'X-DCR-Type': contentType};
  return imageServiceRequest(env, `/v1/cards/${scopeData.cardId}/${scopeData.side}`, {method, headers, body});
}

async function serviceFailure(response) {
  const result = await response.json().catch(() => ({}));
  return error(result.error || 'The image storage service could not complete the request.', response.status >= 400 ? response.status : 502);
}

function validStoredImage(result, scopeData, contentType) {
  const match = String(result?.objectKey || '').match(/^([0-9a-f-]{36})\/([0-9a-f-]{36})\/(front|back)\.(jpg|png|webp)$/i);
  const expectedExtension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}[contentType];
  return result && result.contentType === contentType && result.byteSize > 0 && result.byteSize <= IMAGE_MAX_BYTES
    && /^[0-9a-f]{64}$/i.test(result.sha256 || '')
    && match && match[1] === scopeData.userId && match[2] === scopeData.cardId
    && match[3] === scopeData.side && match[4] === expectedExtension;
}

export async function onRequestPut({request, env, params}) {
  const owner = await scope(request, env, params, true);
  if (owner.response) return owner.response;
  const contentType = supportedImageType(request.headers.get('content-type'));
  if (!contentType) return error('Choose a JPEG, PNG, or WebP image.');
  const image = await readImageBody(request);
  if (image.error) return error(image.error, image.error.includes('10 MB') ? 413 : 400);
  const previous = await owner.db.prepare('SELECT object_key, content_type FROM card_images WHERE card_id = ? AND user_id = ? AND side = ?')
    .bind(owner.cardId, owner.userId, owner.side).first();
  let stored;
  try {
    const response = await callImageService(env, owner, 'put', contentType, '', image.body);
    if (!response.ok) return serviceFailure(response);
    stored = await response.json();
  } catch {
    return error('Oracle image storage is unavailable. Try again later.', 503);
  }
  if (!validStoredImage(stored, owner, contentType)) return error('The image storage service returned invalid metadata.', 502);
  await owner.db.prepare(`INSERT INTO card_images (card_id, user_id, side, object_key, content_type, byte_size, sha256, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(card_id, side) DO UPDATE SET object_key = excluded.object_key, content_type = excluded.content_type,
      byte_size = excluded.byte_size, sha256 = excluded.sha256, updated_at = excluded.updated_at`)
    .bind(owner.cardId, owner.userId, owner.side, stored.objectKey, stored.contentType, stored.byteSize, stored.sha256, Math.floor(Date.now() / 1000)).run();
  if (previous && previous.object_key !== stored.objectKey) {
    try { await callImageService(env, owner, 'delete', previous.content_type, previous.object_key); } catch { /* Keep the new image even if orphan cleanup can be retried later. */ }
  }
  return json({ok: true, side: owner.side, byteSize: stored.byteSize});
}

export async function onRequestGet({request, env, params}) {
  const owner = await scope(request, env, params, true);
  if (owner.response) return owner.response;
  const image = await owner.db.prepare('SELECT object_key, content_type FROM card_images WHERE card_id = ? AND user_id = ? AND side = ?')
    .bind(owner.cardId, owner.userId, owner.side).first();
  if (!image) return error('Card photo not found.', 404);
  try {
    const response = await callImageService(env, owner, 'get', image.content_type, image.object_key);
    if (!response.ok) return serviceFailure(response);
    return new Response(response.body, {headers: {'Content-Type': image.content_type, 'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${owner.side}"`, 'X-Content-Type-Options': 'nosniff'}});
  } catch {
    return error('Oracle image storage is unavailable. Try again later.', 503);
  }
}

export async function onRequestDelete({request, env, params}) {
  const owner = await scope(request, env, params, true);
  if (owner.response) return owner.response;
  const image = await owner.db.prepare('SELECT object_key, content_type FROM card_images WHERE card_id = ? AND user_id = ? AND side = ?')
    .bind(owner.cardId, owner.userId, owner.side).first();
  if (!image) return json({ok: true});
  try {
    const response = await callImageService(env, owner, 'delete', image.content_type, image.object_key);
    if (!response.ok) return serviceFailure(response);
  } catch {
    return error('Oracle image storage is unavailable. Try again later.', 503);
  }
  await owner.db.prepare('DELETE FROM card_images WHERE card_id = ? AND user_id = ? AND side = ?')
    .bind(owner.cardId, owner.userId, owner.side).run();
  return json({ok: true});
}
