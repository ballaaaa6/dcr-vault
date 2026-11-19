import {error, json, readJson} from '../../_utils/http.js';
import {tokenHash} from '../../_utils/sessions.js';

export async function onRequestPost({request, env}) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 2048) return error('Invalid image capability request.', 400);
  const body = await readJson(request);
  if (!body || !/^[A-Za-z0-9_-]{43}$/.test(body.token || '')) return error('Invalid image capability.', 403);
  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(`UPDATE image_capabilities SET used_at = ?
    WHERE token_hash = ? AND card_id = ? AND side = ? AND operation = ? AND content_type = ?
      AND used_at IS NULL AND expires_at > ?
    RETURNING user_id, card_id, side, operation, content_type, object_key`)
    .bind(now, await tokenHash(body.token), body.cardId, body.side, body.operation, body.contentType || '', now).first();
  if (!result) return error('Image capability is expired or already used.', 403);
  return json({ownerId: result.user_id, cardId: result.card_id, side: result.side, operation: result.operation,
    contentType: result.content_type, objectKey: result.object_key});
}
