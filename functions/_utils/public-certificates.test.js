import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestGet as lookup} from '../api/certificates/[cert].js';
import {onRequestPost as create} from '../api/cards.js';
import {onRequestGet as check} from '../api/cards/cert-check.js';
import {onRequestPatch as patch, onRequestDelete as remove} from '../api/cards/[id].js';
import {tokenHash} from './sessions.js';
import {onRequestPut as putImage, onRequestGet as getImage, onRequestDelete as deleteImage} from '../api/cards/[id]/images/[side].js';

function database() {
  const sql = new DatabaseSync(':memory:');
  for (const name of ['0001_users_sessions_cards.sql', '0011_profile_details.sql', '0012_collector_profile.sql', '0014_profile_full_photo.sql', '0002_card_images.sql', '0003_card_label_metadata.sql',
    '0004_card_source_print_identity.sql', '0005_identification_logs.sql', '0024_reading_details.sql', '0006_card_identification_provenance.sql', '0008_card_artist.sql', '0009_private_vault_details.sql', '0010_label_reading_fields.sql', '0013_card_classification.sql', '0023_card_reading_fields.sql']) {
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

test('corner migration preserves existing photos and makes uploaded corners public on their certificate', async () => {
  const {sql, DB} = database();
  sql.prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)').run('owner', 'owner', 'owner', 0, 0);
  sql.prepare('INSERT INTO cards(id,user_id,name,cert_number,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('card', 'owner', 'Card', '00000001', 0, 0);
  const insert = sql.prepare('INSERT INTO card_images(card_id,user_id,side,object_key,content_type,byte_size,sha256,updated_at) VALUES (?,?,?,?,?,?,?,?)');
  insert.run('card', 'owner', 'front', 'original', 'image/png', 10, 'digest', 0);
  sql.exec(readFileSync(new URL('../../migrations/0026_card_corner_images.sql', import.meta.url), 'utf8'));
  insert.run('card', 'owner', 'back-bottom-right', 'corner', 'image/png', 10, 'digest', 0);
  assert.equal(sql.prepare("SELECT object_key FROM card_images WHERE side='front'").get().object_key, 'original');
  const result = await (await lookup({env: {DB}, params: {cert: '1'}})).json();
  assert.deepEqual(result.card.cornerImages, {'back-bottom-right': '/api/cards/card/images/back-bottom-right'});
  assert.equal(result.card.frontImage, '/api/cards/card/images/front');
  assert.throws(() => insert.run('card', 'owner', 'bad-side', 'invalid', 'image/png', 10, 'digest', 0));
  sql.close();
});

test('corner upload and deletion enforce ownership and expose saved images to public certificate viewers', async () => {
  const {sql, DB} = database();
  sql.exec(readFileSync(new URL('../../migrations/0026_card_corner_images.sql', import.meta.url), 'utf8'));
  const owner = '87654321-4321-4321-8321-cba987654321';
  const other = '87654321-4321-4321-8321-cba987654322';
  const cardId = '12345678-1234-4234-8234-123456789abc';
  for (const [id, token] of [[owner, 'owner-token'], [other, 'other-token']]) {
    sql.prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)').run(id, id, id, 0, 0);
    sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(await tokenHash(token), id, Math.floor(Date.now()/1000)+1000, 0);
  }
  sql.prepare('INSERT INTO cards(id,user_id,name,cert_number,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(cardId, owner, 'Card', '00000001', 0, 0);
  const savedFetch = globalThis.fetch;
  let deletedFromStore = 0;
  globalThis.fetch = async (_url, options) => options.method === 'PUT'
    ? Response.json({objectKey: `${owner}/${cardId}/back-top-left.png`, contentType: 'image/png', byteSize: 3, sha256: 'a'.repeat(64)})
    : options.method === 'DELETE' ? (deletedFromStore++, Response.json({ok: true})) : new Response('image', {headers: {'Content-Type': 'image/png'}});
  const params = {id: cardId, side: 'back-top-left'};
  const env = {DB, ORCL_MEDIA_ORIGIN: 'https://images.example.com'};
  const req = (method, token) => new Request(`https://vault.test/api/cards/${cardId}/images/back-top-left`, {method,
    headers: {Cookie: `dcr_session=${token}`, ...(method === 'PUT' ? {'Content-Type': 'image/png'} : {})},
    ...(method === 'PUT' ? {body: new Uint8Array([1, 2, 3])} : {})});
  try {
    assert.equal((await putImage({request: req('PUT', 'other-token'), env, params})).status, 404);
    assert.equal((await putImage({request: req('PUT', 'owner-token'), env, params})).status, 200);
    assert.equal((await getImage({request: req('GET', ''), env, params})).status, 200);
    const certificate = await (await lookup({env, params: {cert: '1'}})).json();
    assert.equal(certificate.card.cornerImages['back-top-left'], `/api/cards/${cardId}/images/back-top-left`);
    assert.equal((await deleteImage({request: req('DELETE', 'other-token'), env, params})).status, 404);
    assert.equal((await deleteImage({request: req('DELETE', 'owner-token'), env, params})).status, 200);
    assert.equal((await getImage({request: req('GET', ''), env, params})).status, 404);
    assert.equal((await putImage({request: req('PUT', 'owner-token'), env, params})).status, 200);
    assert.equal((await remove({request: req('DELETE', 'owner-token'), env, params: {id: cardId}})).status, 200);
    assert.equal(deletedFromStore, 2);
  } finally { globalThis.fetch = savedFetch; sql.close(); }
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
  const card = {name: 'Mew', setName: 'Set', year: '2020', cardNumber: '1', rarity: 'Rare', gradeLabel: 'Mint', certNumber: '1', notes: 'secret', buyPrice: 99};
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

test('only the owner can edit certificate fields or delete and release a certificate', async () => {
  const {sql, DB} = database();
  sql.exec(readFileSync(new URL('../../migrations/0007_global_certificates.sql', import.meta.url), 'utf8'));
  for (const id of ['a', 'b']) {
    sql.prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)').run(id, id, id, 0, 0);
    sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
      .run(await tokenHash(id), id, Math.floor(Date.now() / 1000) + 1000, 0);
  }
  const id = '12345678-1234-4234-8234-123456789abc';
  sql.prepare('INSERT INTO cards(id,user_id,name,cert_number,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .run(id, 'a', 'Before', '00000001', 0, 0);
  const request = (method, user, body) => new Request('https://vault.test/api/cards/' + id, {method,
    headers: {Cookie: `dcr_session=${user}`, Origin: 'https://vault.test', 'Content-Type': 'application/json'},
    ...(body ? {body: JSON.stringify(body)} : {})});
  const context = (method, user, body) => ({request: request(method, user, body), env: {DB}, params: {id}});
  assert.equal((await patch(context('PATCH', 'b', {name: 'Intruder'}))).status, 404);
  assert.equal((await remove(context('DELETE', 'b'))).status, 404);
  assert.equal((await patch(context('PATCH', 'a', {name: 'After', rarity: 'Rare'}))).status, 200);
  assert.equal((await patch(context('PATCH', 'a', {buyPrice: '50', buyCurrency: 'USD', purchaseSource: 'Facebook', seller: 'Shop', receivedDate: '2026-11-22'}))).status, 200);
  const privateRow = sql.prepare('SELECT buy_price, buy_currency, purchase_source, seller, received_date FROM cards WHERE id = ?').get(id);
  assert.deepEqual({...privateRow}, {buy_price: 50, buy_currency: 'USD', purchase_source: 'Facebook', seller: 'Shop', received_date: '2026-11-22'});
  const result = await (await lookup({env: {DB}, params: {cert: '1'}})).json();
  assert.equal(result.card.name, 'After');
  assert.equal(result.card.rarity, 'Rare');
  for (const field of ['buyCurrency', 'purchaseSource', 'seller', 'receivedDate']) assert.equal(field in result.card, false);
  assert.equal((await patch(context('PATCH', 'b', {certNumber: '2'}))).status, 404);
  assert.equal((await patch(context('PATCH', 'a', {certNumber: 'bad'}))).status, 400);
  sql.prepare('INSERT INTO cards(id,user_id,name,cert_number,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .run('other', 'b', 'Other', '00000003', 0, 0);
  assert.equal((await patch(context('PATCH', 'a', {certNumber: '3', name: 'Conflict'}))).status, 409);
  assert.equal((await patch(context('PATCH', 'a', {certNumber: '2'}))).status, 200);
  assert.equal((await (await lookup({env: {DB}, params: {cert: '1'}})).json()).card, null);
  assert.equal((await (await lookup({env: {DB}, params: {cert: '2'}})).json()).card.name, 'After');
  assert.equal(sql.prepare('SELECT id FROM cards WHERE cert_number = ?').get('00000002').id, id);
  assert.equal((await remove(context('DELETE', 'a'))).status, 200);
  assert.equal((await (await lookup({env: {DB}, params: {cert: '2'}})).json()).card, null);
  const checkRequest = new Request('https://vault.test/api/cards/cert-check?cert=1', {headers: {Cookie: 'dcr_session=b'}});
  assert.equal((await (await check({request: checkRequest, env: {DB}})).json()).available, true);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM cards WHERE cert_number = ?').get('00000001').n, 0);
  sql.close();
});
