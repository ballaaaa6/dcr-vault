import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestPost} from '../api/vault-celebration.js';
import {tokenHash} from './sessions.js';

test('celebration is claimed once per empty-to-first-card transition and per account', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../../migrations/0001_users_sessions_cards.sql', import.meta.url), 'utf8'));
  for (const name of ['0011_profile_details.sql', '0012_collector_profile.sql', '0014_profile_full_photo.sql', '0025_vault_celebrations.sql']) sql.exec(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'));
  for (const user of ['a', 'b']) {
    sql.prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES(?,?,?,?,?)').run(user, user, user, 0, 0);
    sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(await tokenHash(user), user, Math.floor(Date.now()/1000)+1000, 0);
  }
  const DB = {prepare: query => ({bind: (...values) => ({first: async () => sql.prepare(query).get(...values) || null})})};
  const claim = async user => (await (await onRequestPost({request: new Request('https://vault.test/api/vault-celebration', {method:'POST', headers:{Origin:'https://vault.test', Cookie:`dcr_session=${user}`}}), env:{DB}})).json()).celebrate;
  const add = (id, user, cert) => sql.prepare('INSERT INTO cards(id,user_id,name,cert_number,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,user,id,cert,0,0);
  add('a1','a','00000001');
  assert.equal(await claim('b'), false);
  assert.equal(await claim('a'), true);
  assert.equal(await claim('a'), false);
  add('a2','a','00000002');
  assert.equal(await claim('a'), false);
  sql.prepare('DELETE FROM cards WHERE id=?').run('a1');
  assert.equal(await claim('a'), false);
  sql.prepare('DELETE FROM cards WHERE id=?').run('a2');
  add('a3','a','00000003');
  assert.equal(await claim('a'), true);
  sql.prepare('DELETE FROM cards WHERE id=?').run('a3');
  add('a4','a','00000004');
  sql.prepare('DELETE FROM cards WHERE id=?').run('a4');
  assert.equal(await claim('a'), false);
});
