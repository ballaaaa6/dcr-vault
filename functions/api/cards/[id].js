import {error, json, readJson, sameOrigin} from '../../_utils/http.js';
import {currentUser} from '../../_utils/sessions.js';

const statuses = new Set(['in-vault', 'for-sale', 'sold', 'grading']);

export async function onRequestPatch({request, env, params}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const patch = cleanPatch(await readJson(request));
  if (!patch) return error('No valid card details were provided.');
  const values = Object.values(patch);
  const columns = Object.keys(patch).map(key => `${key} = ?`).join(', ');
  const result = await env.DB.prepare(`UPDATE cards SET ${columns}, updated_at = ? WHERE id = ? AND user_id = ?`)
    .bind(...values, Math.floor(Date.now() / 1000), params.id, session.user.id).run();
  if (!result.meta?.changes) return error('Card not found in your vault.', 404);
  return json({ok: true});
}

function cleanPatch(input) {
  if (!input || typeof input !== 'object') return null;
  const patch = {};
  if ('buyPrice' in input) patch.buy_price = validPrice(input.buyPrice);
  if ('sellPrice' in input) patch.sell_price = validPrice(input.sellPrice);
  if (input.status && statuses.has(input.status)) patch.status = input.status;
  if (typeof input.boughtFrom === 'string') patch.bought_from = input.boughtFrom.trim().slice(0, 120);
  return Object.keys(patch).length ? patch : null;
}

function validPrice(value) {
  if (value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
