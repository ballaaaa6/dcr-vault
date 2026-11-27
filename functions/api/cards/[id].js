import {error, json, readJson, sameOrigin} from '../../_utils/http.js';
import {currentUser} from '../../_utils/sessions.js';
import {onRequestDelete as deleteImage} from './[id]/images/[side].js';
import {normalizeCertNumber} from '../../_utils/cards.js';
import {locationKey} from '../storage-locations.js';

const statuses = new Set(['in-vault', 'for-sale', 'sold', 'grading']);

export async function onRequestPatch({request, env, params}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const input = await readJson(request);
  if ('collectionNames' in (input || {})) {
    if (!Array.isArray(input.collectionIds) || !Array.isArray(input.collectionNames) || input.collectionNames.some(name => typeof name !== 'string' || !/^[a-zA-Z0-9]{1,120}$/.test(name))) return error('Invalid showcases.');
    input.collectionNames = [...new Map(input.collectionNames.map(name => [name.trim().toLowerCase(), name.trim()])).values()];
  }
  if ('collectionIds' in (input || {})) {
    if (typeof input.storageLocation !== 'string' || !Array.isArray(input.collectionIds) || input.collectionIds.some(id => typeof id !== 'string') || new Set(input.collectionIds).size !== input.collectionIds.length) return error('Invalid showcases.');
    const groups = await env.DB.prepare('SELECT id FROM collections WHERE user_id = ?').bind(session.user.id).all();
    const allowed = new Set((groups.results || []).map(group => group.id));
    if (input.collectionIds.some(id => !allowed.has(id))) return error('Showcase list changed. Please try again.', 409);
  }
  const patch = cleanPatch(input);
  if (!patch) return error('No valid card details were provided.');
  const values = Object.values(patch);
  const columns = Object.keys(patch).map(key => `${key} = ?`).join(', ');
  let result;
  try {
    if (typeof input.storageLocation === 'string') {
      result = await updateWithLocation(env.DB, session.user.id, params.id, input.storageLocation, columns, values, input.collectionIds, input.collectionNames || []);
    } else {
      result = await env.DB.prepare(`UPDATE cards SET ${columns}, updated_at = ? WHERE id = ? AND user_id = ?`)
        .bind(...values, Math.floor(Date.now() / 1000), params.id, session.user.id).run();
    }
  } catch (cause) {
    if (String(cause.message).includes('UNIQUE')) return error('This Cert number is already used. Choose another number.', 409);
    throw cause;
  }
  if (!result.meta?.changes) return error('Card not found in your vault.', 404);
  return json({ok: true});
}

async function updateWithLocation(db, userId, id, value, columns, values, collectionIds, collectionNames) {
  const name = value.trim().slice(0, 120);
  const found = await db.prepare('SELECT id FROM cards WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!found) return {meta: {changes: 0}};
  const statements = [];
  if (name) statements.push(db.prepare('INSERT OR IGNORE INTO storage_locations (id, user_id, name, name_key) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, name, locationKey(name)));
  statements.push(db.prepare(`UPDATE cards SET ${columns}${columns ? ', ' : ''}storage_location_id = (SELECT id FROM storage_locations WHERE user_id = ? AND name_key = ?), updated_at = ? WHERE id = ? AND user_id = ?`)
    .bind(...values, userId, locationKey(name), Math.floor(Date.now() / 1000), id, userId));
  if (collectionIds) {
    statements.push(...collectionNames.map(group => db.prepare('INSERT OR IGNORE INTO collections (id, user_id, name, name_key) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), userId, group, group.toLowerCase())));
    statements.push(db.prepare('DELETE FROM collection_cards WHERE card_id = ? AND collection_id IN (SELECT id FROM collections WHERE user_id = ?)').bind(id, userId));
    statements.push(...collectionIds.map(groupId => db.prepare('INSERT INTO collection_cards (collection_id, card_id) SELECT id, ? FROM collections WHERE id = ? AND user_id = ?').bind(id, groupId, userId)));
    statements.push(...collectionNames.map(group => db.prepare('INSERT OR IGNORE INTO collection_cards (collection_id, card_id) SELECT id, ? FROM collections WHERE name_key = ? AND user_id = ?').bind(id, group.toLowerCase(), userId)));
  }
  const results = await db.batch(statements);
  return results[name ? 1 : 0];
}

function cleanPatch(input) {
  if (!input || typeof input !== 'object') return null;
  const patch = {};
  if ('certNumber' in input) {
    patch.cert_number = normalizeCertNumber(input.certNumber);
    if (!patch.cert_number) return null;
  }
  const fields = {name: ['name', 120], game: ['game', 30], setName: ['set_name', 120], year: ['year', 4],
    cardNumber: ['card_number', 30], rarity: ['rarity', 80], gradeLabel: ['grade_label', 60],
    cardTypeLabel: ['card_type_label', 60], languageLabel: ['language_label', 60], series: ['series', 120],
    category: ['category', 40], pokemonTypes: ['pokemon_types', 120], trainerType: ['trainer_type', 60],
    subtypeDetail: ['subtype_detail', 60], setSource: ['set_source', 30],
    energyKind: ['energy_kind', 40], energyType: ['energy_type', 40],
    sourceFinish: ['source_finish', 80], sourceLanguage: ['source_language', 20]};
  for (const [key, [column, limit]] of Object.entries(fields)) {
    if (typeof input[key] === 'string') patch[column] = input[key].trim().slice(0, limit);
  }
  for (const [key, column] of [['colorElements', 'color_elements'], ['inferredFields', 'inferred_fields']]) {
    if (Array.isArray(input[key])) patch[column] = JSON.stringify([...new Set(input[key].filter(item => typeof item === 'string').map(item => item.trim().slice(0, 60)).filter(Boolean))].slice(0, 10));
  }
  if ('year' in input && typeof input.year === 'string') patch.year_source = 'user';
  if ('name' in input && !patch.name) return null;
  if ('buyPrice' in input) patch.buy_price = validPrice(input.buyPrice);
  if ('sellPrice' in input) patch.sell_price = validPrice(input.sellPrice);
  if (input.status && statuses.has(input.status)) patch.status = input.status;
  if (typeof input.artist === 'string') patch.artist = input.artist.trim().slice(0, 120);
  if (typeof input.position === 'string') patch.storage_position = input.position.trim().slice(0, 200);
  if (typeof input.notes === 'string') patch.notes = input.notes.trim().slice(0, 2000);
  if (typeof input.buyCurrency === 'string' && /^[A-Z]{3}$/.test(input.buyCurrency)) patch.buy_currency = input.buyCurrency;
  if (typeof input.purchaseSource === 'string') patch.purchase_source = input.purchaseSource.trim().slice(0, 120);
  if (typeof input.seller === 'string') patch.seller = input.seller.trim().slice(0, 120);
  if (typeof input.receivedDate === 'string' && (!input.receivedDate || /^\d{4}-\d{2}-\d{2}$/.test(input.receivedDate))) patch.received_date = input.receivedDate;
  if (typeof input.boughtFrom === 'string') patch.bought_from = input.boughtFrom.trim().slice(0, 120);
  return Object.keys(patch).length || typeof input.storageLocation === 'string' ? patch : null;
}

function validPrice(value) {
  if (value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function onRequestDelete({request, env, params}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const card = await env.DB.prepare('SELECT id FROM cards WHERE id = ? AND user_id = ?')
    .bind(params.id, session.user.id).first();
  if (!card) return error('Card not found in your vault.', 404);
  for (const side of ['front', 'back']) {
    const response = await deleteImage({request, env, params: {...params, side}});
    if (!response.ok) return response;
  }
  const result = await env.DB.prepare('DELETE FROM cards WHERE id = ? AND user_id = ?')
    .bind(params.id, session.user.id).run();
  return result.meta?.changes ? json({ok: true}) : error('Card not found in your vault.', 404);
}
