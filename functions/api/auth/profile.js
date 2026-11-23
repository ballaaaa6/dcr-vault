import {json, readJson, sameOrigin} from '../../_utils/http.js';
import {currentUser} from '../../_utils/sessions.js';

const MAX_AVATAR_LENGTH = 180000;

export async function onRequestPut({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  if (Number(request.headers.get('content-length')) > MAX_AVATAR_LENGTH * 2 + 1000) return json({error: 'Photo is too large.'}, 413);
  const body = await readJson(request);
  const hasName = Object.hasOwn(body || {}, 'displayName');
  const hasAvatar = Object.hasOwn(body || {}, 'avatarUrl');
  const hasFullAvatar = Object.hasOwn(body || {}, 'avatarFullUrl');
  const name = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
  const avatar = body?.avatarUrl;
  const details = [['favoriteSeries', 'favorite_series', 80], ['bio', 'bio', 200], ['collectingSince', 'collecting_since', 10], ['collectionGoal', 'collection_goal', 200]];
  const updates = details.filter(([key]) => Object.hasOwn(body || {}, key));
  if (updates.some(([key, , max]) => typeof body[key] !== 'string' || body[key].trim().length > max)) return json({error: 'Personal details are too long.'}, 400);
  if (Object.hasOwn(body || {}, 'collectingSince') && !validDate(body.collectingSince.trim())) return json({error: 'Choose a valid date that is not in the future.'}, 400);
  if (!hasName && !hasAvatar && !hasFullAvatar && !updates.length) return json({error: 'No profile changes provided.'}, 400);
  if (hasFullAvatar && !hasAvatar) return json({error: 'Please save both versions of the photo together.'}, 400);
  if (hasFullAvatar && Boolean(avatar) !== Boolean(body.avatarFullUrl)) return json({error: 'Please save both versions of the photo together.'}, 400);
  if (hasName && (!name || name.length > 20)) return json({error: 'Enter a display name of up to 20 characters.'}, 400);
  if (hasAvatar && (typeof avatar !== 'string' || (avatar !== session.user.avatarUrl && !validAvatar(avatar)))) {
    return json({error: 'Please choose a valid photo.'}, 400);
  }
  if (hasFullAvatar && (typeof body.avatarFullUrl !== 'string' || !validAvatar(body.avatarFullUrl))) return json({error: 'Please choose a valid photo.'}, 400);
  const fields = []; const values = [];
  if (hasName) { fields.push('display_name = ?'); values.push(name); }
  if (hasAvatar) { fields.push('avatar_url = ?'); values.push(avatar); }
  if (hasFullAvatar) { fields.push('avatar_full_url = ?'); values.push(body.avatarFullUrl); }
  else if (hasAvatar) { fields.push('avatar_full_url = ?'); values.push(''); }
  for (const [key, column] of updates) { fields.push(`${column} = ?`); values.push(body[key].trim()); }
  await env.DB.prepare(`UPDATE users SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...values, Math.floor(Date.now() / 1000), session.user.id).run();
  return json({user: {...session.user, ...(hasName && {displayName: name}), ...(hasAvatar && {avatarUrl: avatar}), ...(hasFullAvatar ? {avatarFullUrl: body.avatarFullUrl} : hasAvatar ? {avatarFullUrl: ''} : {}), ...Object.fromEntries(updates.map(([key]) => [key, body[key].trim()]))}});
}

function validAvatar(value) {
  if (!value) return true;
  if (value.length > MAX_AVATAR_LENGTH || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  try { return atob(value.slice(23)).length > 3; } catch { return false; }
}

function validDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
