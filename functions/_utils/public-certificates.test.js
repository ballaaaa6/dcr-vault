import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestGet as lookup} from '../api/certificates/[cert].js';
import {onRequestPost as create} from '../api/cards.js';
import {onRequestGet as check} from '../api/cards/cert-check.js';
import {tokenHash} from './sessions.js';

function database() {
  const sql = new DatabaseSync(':memory:');
  for (const name of ['0001_users_sessions_cards.sql', '0002_card_images.sql', '0003_card_label_metadata.sql',
    '0004_card_source_print_identity.sql', '0005_identification_logs.sql', '0006_card_identification_provenance.sql']) {
    sql.exec(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'));
  }
  const DB = {prepare: query => ({bind: (...values) => ({
    first: async () => sql.prepare(query).get(...values) || null,
    all: async () => ({results: sql.prepare(query).all(...values)}),
    run: async () => ({success: true, meta: {changes: Number(sql.prepare(query).run(...values).changes)}})
  })})};
  return {sql, DB};
}

test('migration rejects existing duplicates without changing certificates', () => {
  const {sql} = database();
  for (const id of ['a', 'b']) {
    sql.prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)').run(id, id, id, 0, 0);
    sql.prepare('INSERT INTO cards(id,user_id,name,cert_number,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id, id, 'Card', '00000001', 0, 0);
  }
  assert.throws(() => sql.exec(readFileSync(new URL('../../migrations/0007_global_certificates.sql', import.meta.url), 'utf8')), /UNIQUE/);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM cards').get().n, 2);
  sql.close();
});

test('global certificates prevent cross-account duplicates and expose only public fields', async () => {
  const {sql, DB} = database();
  sql.exec(readFileSync(new URL('../../migrations/0007_global_certificates.sql', import.meta.url), 'utf8'));
  for (const id of ['a', 'b']) {
    sql.prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)').run(id, id, id, 0, 0);
    sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
      .run(await tokenHash(id), id, Math.floor(Date.now()/1000)+1000, 0);
  }
  const request = (path, user, body) => new Request(`https://vault.test${path}`, {method: body ? 'POST' : 'GET',
    headers: {Cookie: `dcr_session=${user}`, 'Content-Type': 'application/json'}, ...(body ? {body: JSON.stringify(body)} : {})});
  const card = {name: 'Mew', certNumber: '1', notes: 'secret', buyPrice: 99};
  assert.equal((await create({request: request('/api/cards', 'a', card), env: {DB}})).status, 201);
  assert.equal((await create({request: request('/api/cards', 'b', card), env: {DB}})).status, 409);
  assert.equal((await (await check({request: request('/api/cards/cert-check?cert=1', 'b'), env: {DB}})).json()).available, false);
  const response = await lookup({env: {DB}, params: {cert: '1'}});
  const result = await response.json();
  assert.equal(result.card.name, 'Mew');
  assert.equal(result.card.certNumber, '00000001');
  assert.equal('notes' in result.card, false);
  assert.equal('buyPrice' in result.card, false);
  assert.equal('userId' in result.card, false);
  assert.equal((await (await lookup({env: {DB}, params: {cert: '2'}})).json()).card, null);
  sql.close();
});
