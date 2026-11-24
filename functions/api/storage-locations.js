import {error, json, readJson, sameOrigin} from '../_utils/http.js';
import {currentUser} from '../_utils/sessions.js';

function cleanName(value) { return typeof value === 'string' ? value.trim().slice(0, 120) : ''; }
export function locationKey(name) { return cleanName(name).toLowerCase(); }

export async function onRequestGet({request, env}) {
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const rows = await env.DB.prepare(`SELECT l.id, l.name, COUNT(c.id) AS cardCount FROM storage_locations l
    LEFT JOIN cards c ON c.storage_location_id = l.id AND c.user_id = l.user_id
    WHERE l.user_id = ? GROUP BY l.id ORDER BY l.sort_order IS NULL, l.sort_order, l.name COLLATE NOCASE`).bind(session.user.id).all();
  return json({locations: rows.results || []});
}

export async function onRequestPost({request, env}) {
  if (!sameOrigin(request)) return error('Invalid request origin.', 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const name = cleanName((await readJson(request))?.name);
  if (!name) return error('Enter a location name.');
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare('INSERT INTO storage_locations (id, user_id, name, name_key) VALUES (?, ?, ?, ?)')
      .bind(id, session.user.id, name, locationKey(name)).run();
  } catch (cause) {
    if (String(cause.message).includes('UNIQUE')) return error('This location already exists.', 409);
    throw cause;
  }
  return json({location: {id, name, cardCount: 0}}, 201);
}

export async function onRequestPatch({request, env}) {
  if (!sameOrigin(request)) return error('Invalid request origin.', 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const body = await readJson(request);
  if (Array.isArray(body?.order)) return reorderLocations(env.DB, session.user.id, body.order);
  const name = cleanName(body?.name);
  if (!name || typeof body?.id !== 'string') return error('Enter a location name.');
  try {
    const result = await env.DB.prepare('UPDATE storage_locations SET name = ?, name_key = ? WHERE id = ? AND user_id = ?')
      .bind(name, locationKey(name), body.id, session.user.id).run();
    if (!result.meta?.changes) return error('Location not found.', 404);
  } catch (cause) {
    if (String(cause.message).includes('UNIQUE')) return error('This location already exists.', 409);
    throw cause;
  }
  return json({ok: true});
}

async function reorderLocations(db, userId, order) {
  if (order.some(id => typeof id !== 'string') || new Set(order).size !== order.length) return error('Invalid location order.');
  const rows = await db.prepare('SELECT id FROM storage_locations WHERE user_id = ?').bind(userId).all();
  const existing = new Set((rows.results || []).map(row => row.id));
  if (order.length !== existing.size || order.some(id => !existing.has(id))) return error('Location list changed. Please try again.', 409);
  if (order.length) await db.batch(order.map((id, index) => db.prepare('UPDATE storage_locations SET sort_order = ? WHERE id = ? AND user_id = ?').bind(index, id, userId)));
  return json({ok: true});
}

export async function onRequestDelete({request, env}) {
  if (!sameOrigin(request)) return error('Invalid request origin.', 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const body = await readJson(request);
  if (typeof body?.id !== 'string' || typeof body.clearPositions !== 'boolean') return error('Invalid location request.');
  const found = await env.DB.prepare('SELECT id FROM storage_locations WHERE id = ? AND user_id = ?').bind(body.id, session.user.id).first();
  if (!found) return error('Location not found.', 404);
  const statements = [];
  if (body.clearPositions) statements.push(env.DB.prepare("UPDATE cards SET storage_position = '' WHERE storage_location_id = ? AND user_id = ?").bind(body.id, session.user.id));
  statements.push(env.DB.prepare('UPDATE cards SET storage_location_id = NULL WHERE storage_location_id = ? AND user_id = ?').bind(body.id, session.user.id));
  statements.push(env.DB.prepare('DELETE FROM storage_locations WHERE id = ? AND user_id = ?').bind(body.id, session.user.id));
  await env.DB.batch(statements);
  return json({ok: true});
}

export async function onRequestPut({request, env}) {
  if (!sameOrigin(request)) return error('Invalid request origin.', 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const body = await readJson(request);
  if (typeof body?.id !== 'string' || !Array.isArray(body.add) || !Array.isArray(body.remove) ||
      [...body.add, ...body.remove].some(id => typeof id !== 'string')) return error('Invalid location request.');
  const found = await env.DB.prepare('SELECT id FROM storage_locations WHERE id = ? AND user_id = ?').bind(body.id, session.user.id).first();
  if (!found) return error('Location not found.', 404);
  const statements = [
    ...body.add.map(id => env.DB.prepare('UPDATE cards SET storage_location_id = ? WHERE id = ? AND user_id = ?').bind(body.id, id, session.user.id)),
    ...body.remove.map(id => env.DB.prepare('UPDATE cards SET storage_location_id = NULL WHERE id = ? AND user_id = ? AND storage_location_id = ?').bind(id, session.user.id, body.id))
  ];
  if (statements.length) await env.DB.batch(statements);
  return json({ok: true});
}
