import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestPut} from './profile.js';
import {tokenHash} from '../../_utils/sessions.js';

test('profile edits are authenticated, owner-scoped, validated and persistent', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../../../migrations/0001_users_sessions_cards.sql', import.meta.url), 'utf8'));
  sql.prepare('INSERT INTO users(id,google_sub,email,display_name,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('a','ga','a@example.com','Original','https://example.com/avatar',0,0);
  sql.prepare('INSERT INTO users(id,google_sub,email,display_name,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('b','gb','b@example.com','Other',0,0);
  sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(await tokenHash('token'), 'a', 9999999999, 0);
  const env = {DB: {prepare: query => ({bind: (...args) => ({first: async () => sql.prepare(query).get(...args), run: async () => sql.prepare(query).run(...args)})})}};
  const request = (body, cookie = 'dcr_session=token') => new Request('https://example.com/api/auth/profile', {method:'PUT', headers:{'Content-Type':'application/json', Cookie:cookie, Origin:'https://example.com'}, body:JSON.stringify(body)});
  assert.equal((await onRequestPut({request:request({displayName:'Name',avatarUrl:''}, ''),env})).status, 401);
  assert.equal((await onRequestPut({request:request({displayName:' ',avatarUrl:''}),env})).status, 400);
  assert.equal((await onRequestPut({request:request({displayName:'Name',avatarUrl:'https://evil.example'}),env})).status, 400);
  assert.equal((await onRequestPut({request:request({displayName:'  Collector  ',avatarUrl:'data:image/jpeg;base64,/9j/2Q=='}),env})).status, 200);
  assert.equal(sql.prepare('SELECT display_name FROM users WHERE id = ?').get('a').display_name, 'Collector');
  assert.equal(sql.prepare('SELECT display_name FROM users WHERE id = ?').get('b').display_name, 'Other');
  assert.equal((await onRequestPut({request:request({displayName:'Collector',avatarUrl:''}),env})).status, 200);
  assert.equal(sql.prepare('SELECT avatar_url FROM users WHERE id = ?').get('a').avatar_url, '');
  sql.close();
});
