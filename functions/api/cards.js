import {cardResponse, cardValues, normalizeCard} from '../_utils/cards.js';
import {error, json, readJson, requireDatabase, sameOrigin} from '../_utils/http.js';
import {currentUser} from '../_utils/sessions.js';

const INSERT_CARD = `INSERT INTO cards (id, user_id, game, name, set_name, year, year_series, catalog_card_id,
  source_language, source_set_id, source_card_id, source_finish, card_number, rarity, grade_label,
  cert_number, status, buy_price, sell_price, buy_date, sold_date, bought_from, sold_to, notes, identification_status, field_provenance, artist, buy_currency, purchase_source, seller, received_date, card_type_label, language_label, series, category, pokemon_types, trainer_type, energy_kind, energy_type, color_elements, subtype_detail, set_source, inferred_fields, created_at, updated_at)
  VALUES (${Array(45).fill('?').join(', ')})`;

export async function onRequestGet({request, env}) {
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const rows = await env.DB.prepare(`SELECT cards.*,
    (SELECT name FROM storage_locations WHERE id = cards.storage_location_id AND user_id = cards.user_id) AS storage_location,
    (SELECT object_key FROM card_images WHERE card_id = cards.id AND side = 'front') AS front_object_key,
    (SELECT object_key FROM card_images WHERE card_id = cards.id AND side = 'back') AS back_object_key
    FROM cards WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(session.user.id).all();
  return json({cards: (rows.results || []).map(cardResponse)});
}

export async function onRequestPost({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const card = normalizeCard(await readJson(request));
  if (!card || ![card.setName, card.year, card.cardNumber, card.rarity, card.gradeLabel].every(Boolean)) return error('Complete all required card details and enter a valid certificate number.');
  return insertCard(env.DB, session.user.id, card);
}

async function insertCard(db, userId, card) {
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  let result;
  try { result = await db.prepare(INSERT_CARD).bind(id, userId, ...cardValues(card), now, now).run(); }
  catch (error) {
    if (String(error.message).includes('UNIQUE')) return errorResponse();
    throw error;
  }
  if (!result.success) return error('This Cert number is already used. Choose another number.', 409);
  return json({card: {...card, id, createdAt: now, updatedAt: now}}, 201);
}

function errorResponse() {
  return error('This Cert number is already used. Choose another number.', 409);
}
