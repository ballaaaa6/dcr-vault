import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {establishSession} from '../api/auth/google.js';
import {currentUser} from './sessions.js';

test('Google sign-in preserves uploaded photos and repairs a legacy Google thumbnail on read', async () => {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['0001_users_sessions_cards.sql', '0011_profile_details.sql', '0012_collector_profile.sql', '0014_profile_full_photo.sql']) {
    sql.exec(readFileSync(new URL(`../../migrations/${file}`, import.meta.url), 'utf8'));
  }
  const env = {DB: {prepare: query => ({bind: (...args) => ({first: async () => sql.prepare(query).get(...args), run: async () => sql.prepare(query).run(...args)})})}};
  const request = new Request('https://example.com/api/auth/google');
  const claims = {sub: 'google-id', email: 'user@example.com', name: 'User', picture: 'https://google.example/photo'};
  let response = await establishSession(claims, request, env);
  assert.equal((await response.json()).user.avatarUrl, claims.picture);
  const full = 'data:image/jpeg;base64,/9j/2Q==';
  sql.prepare('UPDATE users SET avatar_full_url = ? WHERE google_sub = ?').run(full, claims.sub);
  response = await establishSession({...claims, picture: 'https://google.example/new'}, request, env);
  const user = (await response.json()).user;
  assert.equal(user.avatarUrl, full);
  assert.equal(user.avatarFullUrl, full);
  const cookie = response.headers.get('set-cookie').match(/dcr_session=[^;]+/)[0];
  const session = await currentUser(new Request('https://example.com/', {headers: {cookie}}), env);
  assert.equal(session.user.avatarUrl, full);
  sql.prepare('UPDATE users SET avatar_url = ? WHERE google_sub = ?').run('data:image/jpeg;base64,/9j/4AA=', claims.sub);
  response = await establishSession(claims, request, env);
  assert.equal((await response.json()).user.avatarUrl, 'data:image/jpeg;base64,/9j/4AA=');
  sql.close();
});
