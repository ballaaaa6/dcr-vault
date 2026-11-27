import {cardValues, normalizeCard} from '../../_utils/cards.js';
import {error, json, readJson, sameOrigin} from '../../_utils/http.js';
import {currentUser} from '../../_utils/sessions.js';

export async function onRequestPost({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const body = await readJson(request);
  if (!Array.isArray(body?.cards) || body.cards.length > 1000) return error('Import must contain up to 1,000 cards.');
  const result = await importCards(env.DB, session.user.id, body.cards);
  return json(result);
}

async function importCards(db, userId, entries) {
  let imported = 0;
  let skipped = 0;
  for (const entry of entries) {
    const card = normalizeCard(entry);
    if (!card) { skipped += 1; continue; }
    const result = await insertLegacyCard(db, userId, card);
    if (result.meta?.changes) imported += 1;
    else skipped += 1;
  }
  return {imported, skipped};
}

async function insertLegacyCard(db, userId, card) {
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  return db.prepare(`INSERT OR IGNORE INTO cards (id, user_id, game, name, set_name, year, year_series, catalog_card_id,
    source_language, source_set_id, source_card_id, source_finish, card_number, rarity, grade_label, cert_number, status, buy_price, sell_price, buy_date, sold_date,
    bought_from, sold_to, notes, identification_status, field_provenance, artist, buy_currency, purchase_source, seller, received_date, card_type_label, language_label, series, category, pokemon_types, trainer_type, energy_kind, energy_type, color_elements, subtype_detail, set_source, inferred_fields, created_at, updated_at)
    VALUES (${Array(45).fill('?').join(', ')})`)
    .bind(id, userId, ...cardValues(card), now, now).run();
}
