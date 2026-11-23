import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {reserveKey, recordAttempt, keyIdentifier} from './gemini-usage.js';

test('rotation persists across callers and attempts retain nullable token usage', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0015_gemini_usage.sql', import.meta.url), 'utf8'));
  const db = {prepare: sql => ({first: async () => sqlite.prepare(sql).get(), bind: (...args) => ({run: async () => sqlite.prepare(sql).run(...args)})})};
  assert.deepEqual(await Promise.all(Array.from({length: 8}, () => reserveKey(db, 6))), [0, 1, 2, 3, 4, 5, 0, 1]);
  const keyId = await keyIdentifier('test-key');
  await recordAttempt(db, {requestId: 'a', slot: 1, keyId, model: 'test', outcome: 'success', status: 200, usage: {promptTokenCount: 12, candidatesTokenCount: 3, totalTokenCount: 15}});
  await recordAttempt(db, {requestId: 'a', slot: 1, keyId, model: 'test', outcome: 'quota', status: 429});
  const rows = sqlite.prepare('SELECT * FROM gemini_attempts ORDER BY id').all();
  assert.equal(rows[0].key_slot, 2);
  assert.equal(rows[0].total_tokens, 15);
  assert.equal(rows[1].total_tokens, null);
  assert.notEqual(keyId, 'test-key');
});


test('usage endpoint rejects non-administrators before accessing usage data', async () => {
  const {onRequestGet} = await import('../api/gemini-usage.js');
  let queried = false;
  const env = {GEMINI_USAGE_ADMIN_EMAILS: 'owner@example.com', DB: {prepare: sql => ({bind: () => ({first: async () => {
    if (!sql.includes('FROM sessions')) queried = true;
    return {id: 'u', email: 'other@example.com'};
  }})})}};
  const request = new Request('https://example.com/api/gemini-usage', {headers: {Cookie: 'dcr_session=test'}});
  assert.equal((await onRequestGet({request, env})).status, 403);
  assert.equal(queried, false);
});
