import {json, readJson, sameOrigin} from '../../_utils/http.js';
import {currentUser} from '../../_utils/sessions.js';

const MAX_AVATAR_LENGTH = 180000;

export async function onRequestPut({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  if (Number(request.headers.get('content-length')) > MAX_AVATAR_LENGTH + 1000) return json({error: 'Photo is too large.'}, 413);
  const body = await readJson(request);
  const hasName = Object.hasOwn(body || {}, 'displayName');
  const hasAvatar = Object.hasOwn(body || {}, 'avatarUrl');
  const name = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
  const avatar = body?.avatarUrl;
  if (!hasName && !hasAvatar) return json({error: 'No profile changes provided.'}, 400);
  if (hasName && (!name || name.length > 12)) return json({error: 'Enter a display name of up to 12 characters.'}, 400);
  if (hasAvatar && (typeof avatar !== 'string' || (avatar !== session.user.avatarUrl && !validAvatar(avatar)))) {
    return json({error: 'Please choose a valid photo.'}, 400);
  }
  const fields = []; const values = [];
  if (hasName) { fields.push('display_name = ?'); values.push(name); }
  if (hasAvatar) { fields.push('avatar_url = ?'); values.push(avatar); }
  await env.DB.prepare(`UPDATE users SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...values, Math.floor(Date.now() / 1000), session.user.id).run();
  return json({user: {...session.user, ...(hasName && {displayName: name}), ...(hasAvatar && {avatarUrl: avatar})}});
}

function validAvatar(value) {
  if (!value) return true;
  if (value.length > MAX_AVATAR_LENGTH || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  try { return atob(value.slice(23)).length > 3; } catch { return false; }
}
