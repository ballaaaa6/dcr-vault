import {currentUser} from '../_utils/sessions.js';
import {error, json} from '../_utils/http.js';
import {configuredApiKeys} from '../_utils/gemini-card-reader.js';
import {keyIdentifier} from '../_utils/gemini-usage.js';

export async function onRequestGet({request, env}) {
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const admins = String(env.GEMINI_USAGE_ADMIN_EMAILS || '').split(/[\s,;]+/).filter(Boolean).map(email => email.toLowerCase());
  if (!admins.includes(session.user.email.toLowerCase())) {
    return error('Access denied.', 403);
  }
  const params = new URL(request.url).searchParams;
  const from = params.get('from') || '1970-01-01';
  const to = params.get('to') || '9999-12-30';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to ||
      !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to))) return error('Invalid dates.', 400);
  const result = await env.DB.prepare(`SELECT key_slot AS slot, key_id AS keyId, model, count(*) AS attempts,
    sum(outcome = 'success') AS successes, sum(outcome != 'success') AS failures,
    sum(prompt_tokens) AS promptTokens, sum(output_tokens) AS outputTokens, sum(total_tokens) AS totalTokens,
    sum(total_tokens IS NULL) AS missingUsage
    FROM gemini_attempts WHERE created_at >= unixepoch(?) AND created_at < unixepoch(?, '+1 day')
    GROUP BY key_slot, key_id, model ORDER BY key_slot, key_id, model`).bind(from, to).all();
  const rows = result.results || [];
  const keys = await Promise.all(configuredApiKeys(env).map(async (key, index) => ({slot: index + 1, keyId: await keyIdentifier(key)})));
  for (const key of keys) {
    if (!rows.some(row => row.keyId === key.keyId)) rows.push({...key, model: 'No recorded usage', attempts: 0, successes: 0, failures: 0, promptTokens: null, outputTokens: null, totalTokens: null, missingUsage: 0});
  }
  rows.sort((a, b) => a.slot - b.slot);
  return json({rows});
}
