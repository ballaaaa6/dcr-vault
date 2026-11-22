import {error, json, readJson, sameOrigin} from '../../_utils/http.js';
import {currentUser} from '../../_utils/sessions.js';
import {onRequestDelete as deleteImage} from './[id]/images/[side].js';
import {normalizeCertNumber} from '../../_utils/cards.js';

const statuses = new Set(['in-vault', 'for-sale', 'sold', 'grading']);

export async function onRequestPatch({request, env, params}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const patch = cleanPatch(await readJson(request));
  if (!patch) return error('No valid card details were provided.');
  const values = Object.values(patch);
  const columns = Object.keys(patch).map(key => `${key} = ?`).join(', ');
  let result;
  try {
    result = await env.DB.prepare(`UPDATE cards SET ${columns}, updated_at = ? WHERE id = ? AND user_id = ?`)
      .bind(...values, Math.floor(Date.now() / 1000), params.id, session.user.id).run();
  } catch (cause) {
    if (String(cause.message).includes('UNIQUE')) return error('This Cert number is already used. Choose another number.', 409);
    throw cause;
  }
  if (!result.meta?.changes) return error('Card not found in your vault.', 404);
  return json({ok: true});
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
    sourceFinish: ['source_finish', 30], sourceLanguage: ['source_language', 20]};
  for (const [key, [column, limit]] of Object.entries(fields)) {
    if (typeof input[key] === 'string') patch[column] = input[key].trim().slice(0, limit);
  }
  if ('name' in input && !patch.name) return null;
  if ('buyPrice' in input) patch.buy_price = validPrice(input.buyPrice);
  if ('sellPrice' in input) patch.sell_price = validPrice(input.sellPrice);
  if (input.status && statuses.has(input.status)) patch.status = input.status;
  if (typeof input.artist === 'string') patch.artist = input.artist.trim().slice(0, 120);
  if (typeof input.notes === 'string') patch.notes = input.notes.trim().slice(0, 2000);
  if (typeof input.buyCurrency === 'string' && /^[A-Z]{3}$/.test(input.buyCurrency)) patch.buy_currency = input.buyCurrency;
  if (typeof input.purchaseSource === 'string') patch.purchase_source = input.purchaseSource.trim().slice(0, 120);
  if (typeof input.seller === 'string') patch.seller = input.seller.trim().slice(0, 120);
  if (typeof input.receivedDate === 'string' && (!input.receivedDate || /^\d{4}-\d{2}-\d{2}$/.test(input.receivedDate))) patch.received_date = input.receivedDate;
  if (typeof input.boughtFrom === 'string') patch.bought_from = input.boughtFrom.trim().slice(0, 120);
  return Object.keys(patch).length ? patch : null;
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
