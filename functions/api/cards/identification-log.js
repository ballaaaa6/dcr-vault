import {json, sameOrigin} from '../../_utils/http.js';
import {currentUser} from '../../_utils/sessions.js';
import {safeLogPayload} from '../../_utils/identification-log.js';

export async function onRequestGet({request, env}) {
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const id = new URL(request.url).searchParams.get('requestId') || '';
  const row = await env.DB.prepare(`SELECT request_id, created_at, expires_at, model, duration_ms, outcome, reading_json, browser_json, selection_json, save_json
    FROM identification_logs WHERE request_id = ? AND user_id = ? AND expires_at > ?`)
    .bind(id, session.user.id, Math.floor(Date.now() / 1000)).first();
  return row ? json({log: row}) : json({error: 'Log not found.'}, 404);
}

export async function onRequestPost({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 16000) return json({error: 'Log too large.'}, 413);
  const raw = await readLimitedBody(request, 16000);
  if (raw === null) return json({error: 'Log too large.'}, 413);
  let data;
  try { data = JSON.parse(raw); } catch { return json({error: 'Invalid log.'}, 400); }
  const id = String(data?.requestId || '');
  if (!/^[a-f0-9-]{36}$/i.test(id)) return json({error: 'Invalid request ID.'}, 400);
  const short = value => typeof value === 'string' ? value.slice(0, 120) : '';
  const stage = data.stage || 'browser';
  const column = {browser: 'browser_json', selection: 'selection_json', save: 'save_json'}[stage];
  if (!['browser', 'selection', 'save'].includes(stage)) return json({error: 'Invalid log stage.'}, 400);
  const browser = {stage, yearSource: short(data.yearSource), setValueSource: short(data.setValueSource), match: short(data.match), selected: short(data.selected), outcome: short(data.outcome),
    provenance: Object.fromEntries(['name', 'setName', 'year', 'series', 'cardNumber', 'rarity'].map(key => [key, short(data.provenance?.[key])])), candidates: Array.isArray(data.candidates) ? data.candidates.slice(0, 12).map(short) : [],
    values: Object.fromEntries(['name', 'setName', 'year', 'series', 'cardNumber', 'rarity'].map(key => [key, short(data.values?.[key])])),
    fieldStates: Object.fromEntries(['year', 'series', 'setName'].map(key => [key, short(data.fieldStates?.[key])])),
    conflicts: Array.isArray(data.conflicts) ? data.conflicts.slice(0, 8).map(short) : []};
  const retry = stage === 'save' && data.outcome === 'saved'
    ? ` OR (${column} != '{}' AND json_extract(${column}, '$.outcome') = 'error')` : '';
  const assignment = stage === 'save' && data.outcome === 'saved'
    ? `CASE WHEN json_extract(${column}, '$.outcome') = 'error' THEN json_set(?, '$.priorOutcome', 'error') ELSE ? END` : '?';
  const payload = safeLogPayload(browser);
  const payloadValues = assignment === '?' ? [payload] : [payload, payload];
  const result = await env.DB.prepare(`UPDATE identification_logs SET ${column} = ${assignment}
    WHERE request_id = ? AND user_id = ? AND expires_at > ? AND (${column} = '{}'${retry})`)
    .bind(...payloadValues, id, session.user.id, Math.floor(Date.now() / 1000)).run();
  return result.meta?.changes ? json({ok: true}) : json({error: 'Log not found.'}, 404);
}

async function readLimitedBody(request, limit) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let result = '';
  while (true) {
    const {value, done} = await reader.read();
    if (done) return result + decoder.decode();
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return null; }
    result += decoder.decode(value, {stream: true});
  }
}
