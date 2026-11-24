import {error, json, requireDatabase} from '../../_utils/http.js';

export async function onRequestGet({env, params}) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  if (!/^(?:[A-Za-z0-9]{8})$/.test(params.token || '')) return error('Showcase not found.', 404);
  const group = await env.DB.prepare('SELECT id, user_id, name, description FROM collections WHERE share_token = ?').bind(params.token).first();
  if (!group) return error('Showcase not found.', 404);
  const rows = await env.DB.prepare(`SELECT cards.id, cards.name, cards.set_name, cards.year, cards.grade_label, cards.cert_number,
    EXISTS(SELECT 1 FROM card_images WHERE card_id = cards.id AND side = 'front') AS has_front
    FROM collection_cards cc JOIN cards ON cards.id = cc.card_id
    WHERE cc.collection_id = ? AND cards.user_id = ? ORDER BY cc.sort_order IS NULL, cc.sort_order, cards.name COLLATE NOCASE`).bind(group.id, group.user_id).all();
  return json({collection: {name: group.name, description: group.description, cards: (rows.results || []).map(row => ({
    name: row.name, setName: row.set_name, year: row.year, gradeLabel: row.grade_label, certNumber: row.cert_number,
    frontImage: row.has_front ? `/api/cards/${encodeURIComponent(row.id)}/images/front` : ''
  }))}}, 200, {'Referrer-Policy': 'no-referrer'});
}
