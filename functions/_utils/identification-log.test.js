import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {recordIdentification} from './identification-log.js';
import {tokenHash} from './sessions.js';
import {onRequestGet, onRequestPost} from '../api/cards/identification-log.js';

test('logs are owner-scoped, bounded, and deleted at expiry', async () => {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['0001_users_sessions_cards.sql', '0011_profile_details.sql', '0012_collector_profile.sql', '0014_profile_full_photo.sql', '0005_identification_logs.sql']) {
    sql.exec(readFileSync(new URL(`../../migrations/${file}`, import.meta.url), 'utf8'));
  }
  const now = Math.floor(Date.now() / 1000);
  for (const user of ['owner', 'other']) {
    sql.prepare('INSERT INTO users(id, google_sub, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(user, user, user, now, now);
    sql.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(await tokenHash(user), user, now + 1000, now);
  }
  const DB = {prepare: query => ({bind: (...values) => ({
    first: async () => sql.prepare(query).get(...values) || null,
    run: async () => ({success: true, meta: {changes: Number(sql.prepare(query).run(...values).changes)}})
  })})};
  const requestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  await recordIdentification(DB, 'owner', {requestId, model: 'test', durationMs: 3, outcome: 'success', reading: {name: 'Mew'}});
  const req = (user, options = {}) => new Request(`https://vault.test/api/cards/identification-log?requestId=${requestId}`,
    {headers: {Cookie: `dcr_session=${user}`, Origin: 'https://vault.test', 'Content-Type': 'application/json'}, ...options});
  assert.equal((await onRequestGet({request: req('other'), env: {DB}})).status, 404);
  const post = {method: 'POST', body: JSON.stringify({requestId, match: 'unresolved', values: {name: 'Mew', series: 'Neo'}, fieldStates: {series: 'user_preserved'}})};
  assert.equal((await onRequestPost({request: req('other', post), env: {DB}})).status, 404);
  assert.equal((await onRequestPost({request: req('owner', post), env: {DB}})).status, 200);
  const selection = {method: 'POST', body: JSON.stringify({requestId, stage: 'selection', selected: 'candidate-1'})};
  const failure = {method: 'POST', body: JSON.stringify({requestId, stage: 'save', outcome: 'error'})};
  const save = {method: 'POST', body: JSON.stringify({requestId, stage: 'save', outcome: 'saved', values: {name: 'Edited'}})};
  assert.equal((await onRequestPost({request: req('owner', selection), env: {DB}})).status, 200);
  assert.equal((await onRequestPost({request: req('owner', failure), env: {DB}})).status, 200);
  assert.equal((await onRequestPost({request: req('owner', save), env: {DB}})).status, 200);
  const found = await (await onRequestGet({request: req('owner'), env: {DB}})).json();
  assert.equal(JSON.parse(found.log.browser_json).values.name, 'Mew');
  assert.equal(JSON.parse(found.log.browser_json).values.series, 'Neo');
  assert.equal(JSON.parse(found.log.browser_json).fieldStates.series, 'user_preserved');
  assert.equal(JSON.parse(found.log.selection_json).selected, 'candidate-1');
  assert.equal(JSON.parse(found.log.save_json).values.name, 'Edited');
  assert.equal(JSON.parse(found.log.save_json).priorOutcome, 'error');
  assert.equal((await onRequestPost({request: req('owner', {method: 'POST', body: 'x'.repeat(16001)}), env: {DB}})).status, 413);
  const expiry = sql.prepare('SELECT expires_at FROM identification_logs WHERE request_id = ?').get(requestId).expires_at;
  sql.prepare('DELETE FROM identification_logs WHERE expires_at <= ?').run(expiry);
  assert.equal((await onRequestGet({request: req('owner'), env: {DB}})).status, 404);
  sql.close();
});
