import {error, json, readJson, sameOrigin} from '../_utils/http.js';
import {currentUser} from '../_utils/sessions.js';

const clean = value => typeof value === 'string' ? value.trim().slice(0, 120) : '';

export async function onRequestGet({request, env}) {
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const user = session.user.id;
  const [groups, members] = await Promise.all([
    env.DB.prepare('SELECT id, name, description, share_token AS shareToken FROM collections WHERE user_id = ? ORDER BY sort_order IS NULL, sort_order, name COLLATE NOCASE').bind(user).all(),
    env.DB.prepare('SELECT cc.collection_id, cc.card_id FROM collection_cards cc JOIN collections c ON c.id = cc.collection_id JOIN cards ON cards.id = cc.card_id WHERE c.user_id = ? AND cards.user_id = ? ORDER BY cc.sort_order IS NULL, cc.sort_order, cards.name COLLATE NOCASE').bind(user, user).all()
  ]);
  return json({collections: (groups.results || []).map(group => {
    const cardIds = (members.results || []).filter(row => row.collection_id === group.id).map(row => row.card_id);
    return {...group, cardIds, cardCount: cardIds.length};
  })});
}

async function authorize(request, env) {
  if (!sameOrigin(request)) return {response: error('Invalid request origin.', 403)};
  return currentUser(request, env);
}

export async function onRequestPost({request, env}) {
  const session = await authorize(request, env);
  if (session.response) return session.response;
  const name = clean((await readJson(request))?.name);
  if (!name) return error('Enter a collection name.');
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare('INSERT INTO collections (id, user_id, name, name_key) VALUES (?, ?, ?, ?)').bind(id, session.user.id, name, name.toLowerCase()).run();
  } catch (cause) {
    if (String(cause.message).includes('UNIQUE')) return error('This collection already exists.', 409);
    throw cause;
  }
  return json({collection: {id, name, cardIds: [], cardCount: 0}}, 201);
}

export async function onRequestPatch({request, env}) {
  const session = await authorize(request, env);
  if (session.response) return session.response;
  const body = await readJson(request);
  const user = session.user.id;
  if (typeof body?.id === 'string' && typeof body.share === 'boolean') {
    const token = body.share ? Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') : null;
    const result = await env.DB.prepare('UPDATE collections SET share_token = ? WHERE id = ? AND user_id = ?').bind(token, body.id, user).run();
    return result.meta?.changes ? json({shareToken: token}) : error('Collection not found.', 404);
  }
  if (typeof body?.id === 'string' && Array.isArray(body.cardOrder)) {
    const rows = await env.DB.prepare('SELECT cc.card_id FROM collection_cards cc JOIN collections c ON c.id = cc.collection_id JOIN cards ON cards.id = cc.card_id WHERE c.id = ? AND c.user_id = ? AND cards.user_id = ?').bind(body.id, user, user).all();
    const ids = new Set((rows.results || []).map(row => row.card_id));
    if (body.cardOrder.length !== ids.size || new Set(body.cardOrder).size !== ids.size || body.cardOrder.some(id => !ids.has(id))) return error('Card list changed. Please try again.', 409);
    if (ids.size) await env.DB.batch(body.cardOrder.map((id, index) => env.DB.prepare('UPDATE collection_cards SET sort_order = ? WHERE collection_id = ? AND card_id = ?').bind(index, body.id, id)));
    return json({ok: true});
  }
  if (Array.isArray(body?.order)) {
    const rows = await env.DB.prepare('SELECT id FROM collections WHERE user_id = ?').bind(user).all();
    const ids = new Set((rows.results || []).map(row => row.id));
    if (body.order.length !== ids.size || new Set(body.order).size !== ids.size || body.order.some(id => !ids.has(id))) return error('Collection list changed. Please try again.', 409);
    if (body.order.length) await env.DB.batch(body.order.map((id, index) => env.DB.prepare('UPDATE collections SET sort_order = ? WHERE id = ? AND user_id = ?').bind(index, id, user)));
    return json({ok: true});
  }
  const name = clean(body?.name);
  if (!name || typeof body?.id !== 'string') return error('Enter a collection name.');
  try {
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
    const result = await env.DB.prepare('UPDATE collections SET name = ?, name_key = ?, description = CASE WHEN ? THEN ? ELSE description END WHERE id = ? AND user_id = ?').bind(name, name.toLowerCase(), typeof body.description === 'string' ? 1 : 0, description, body.id, user).run();
    if (!result.meta?.changes) return error('Collection not found.', 404);
  } catch (cause) {
    if (String(cause.message).includes('UNIQUE')) return error('This collection already exists.', 409);
    throw cause;
  }
  return json({ok: true});
}

export async function onRequestDelete({request, env}) {
  const session = await authorize(request, env);
  if (session.response) return session.response;
  const body = await readJson(request);
  if (typeof body?.id !== 'string') return error('Invalid collection request.');
  const result = await env.DB.prepare('DELETE FROM collections WHERE id = ? AND user_id = ?').bind(body.id, session.user.id).run();
  return result.meta?.changes ? json({ok: true}) : error('Collection not found.', 404);
}

export async function onRequestPut({request, env}) {
  const session = await authorize(request, env);
  if (session.response) return session.response;
  const body = await readJson(request);
  const user = session.user.id;
  if (typeof body?.id !== 'string' || !Array.isArray(body.add) || !Array.isArray(body.remove) || [...body.add, ...body.remove].some(id => typeof id !== 'string')) return error('Invalid collection request.');
  const group = await env.DB.prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?').bind(body.id, user).first();
  if (!group) return error('Collection not found.', 404);
  const statements = [
    ...body.add.map(id => env.DB.prepare('INSERT OR IGNORE INTO collection_cards (collection_id, card_id) SELECT ?, id FROM cards WHERE id = ? AND user_id = ?').bind(body.id, id, user)),
    ...body.remove.map(id => env.DB.prepare('DELETE FROM collection_cards WHERE collection_id = ? AND card_id = ? AND EXISTS (SELECT 1 FROM cards WHERE id = ? AND user_id = ?)').bind(body.id, id, id, user))
  ];
  if (statements.length) await env.DB.batch(statements);
  return json({ok: true});
}
