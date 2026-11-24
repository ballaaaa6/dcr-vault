import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestGet, onRequestPost, onRequestPatch, onRequestPut, onRequestDelete} from '../api/collections.js';
import {onRequestPatch as patchCard} from '../api/cards/[id].js';
import {tokenHash} from './sessions.js';
import {onRequestGet as getShared} from '../api/shared-collection/[token].js';

test('collections support overlapping membership and protect ownership and locations', async () => {
  const sql = new DatabaseSync(':memory:');
  for (const name of ['0001_users_sessions_cards','0002_card_images','0003_card_label_metadata','0004_card_source_print_identity', '0005_identification_logs','0006_card_identification_provenance','0008_card_artist','0009_private_vault_details','0010_label_reading_fields','0011_profile_details','0012_collector_profile','0013_card_classification','0014_profile_full_photo','0016_storage_locations','0017_location_order','0018_collections','0020_collection_sharing']) sql.exec(readFileSync(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8'));
  for (const user of ['a', 'b']) {
    sql.prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)').run(user,user,user,0,0);
    sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(await tokenHash(user),user,Math.floor(Date.now()/1000)+1000,0);
    sql.prepare('INSERT INTO cards(id,user_id,name,cert_number,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(user,user,'Card',user === 'a' ? '00000001' : '00000002',0,0);
  }
  const DB = {prepare: query => ({bind: (...values) => ({
    first: async () => sql.prepare(query).get(...values) || null,
    all: async () => ({results: sql.prepare(query).all(...values)}),
    run: async () => ({success: true, meta: {changes: Number(sql.prepare(query).run(...values).changes)}})
  })}), batch: async statements => { sql.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; } catch (cause) { sql.exec('ROLLBACK'); throw cause; } }};
  const call = (handler, user, method, body, params) => handler({request: new Request('https://vault.test/api/collections', {method, headers: {Cookie: `dcr_session=${user}`, Origin: 'https://vault.test', 'Content-Type': 'application/json'}, ...(body ? {body: JSON.stringify(body)} : {})}), env: {DB}, params});
  const first = (await (await call(onRequestPost, 'a', 'POST', {name: 'Favorites'})).json()).collection;
  assert.equal((await call(onRequestPost, 'a', 'POST', {name: 'ชื่อ ไทย'})).status, 400);
  assert.equal((await call(onRequestPost, 'a', 'POST', {name: 'Bad name'})).status, 400);
  const second = (await (await call(onRequestPost, 'a', 'POST', {name: 'Pikachu'})).json()).collection;
  assert.equal((await call(onRequestPost, 'a', 'POST', {name: 'favorites'})).status, 409);
  assert.equal((await call(onRequestPut, 'a', 'PUT', {id: first.id, add: ['a', 'b'], remove: []})).status, 200);
  assert.equal((await call(onRequestPut, 'a', 'PUT', {id: second.id, add: ['a'], remove: []})).status, 200);
  assert.equal((await call(onRequestPatch, 'b', 'PATCH', {id: first.id, share: true})).status, 404);
  const token = (await (await call(onRequestPatch, 'a', 'PATCH', {id: first.id, share: true})).json()).shareToken;
  assert.match(token, /^[A-Za-z0-9]{8}$/);
  const legacyToken = 'f8bc065b2433b9233f65e5bdbc28cb828eee408f75b7c8f623fa8cc9f9d2c8e9';
  sql.prepare('UPDATE collections SET share_token = ? WHERE id = ?').run(legacyToken, second.id);
  assert.equal((await getShared({env: {DB}, params: {token: legacyToken}})).status, 200);
  const shared = await getShared({env: {DB}, params: {token}});
  const publicGroup = (await shared.json()).collection;
  assert.equal(publicGroup.cards.length, 1);
  assert.deepEqual(Object.keys(publicGroup.cards[0]).sort(), ['certNumber', 'frontImage', 'gradeLabel', 'name', 'setName', 'year'].sort());
  assert.equal((await call(onRequestPatch, 'a', 'PATCH', {id: first.id, share: false})).status, 200);
  assert.equal((await getShared({env: {DB}, params: {token}})).status, 404);
  let groups = (await (await call(onRequestGet, 'a', 'GET')).json()).collections;
  assert.deepEqual(groups.map(group => group.cardIds), [['a'], ['a']]);
  assert.deepEqual((await (await call(onRequestGet, 'b', 'GET')).json()).collections, []);
  assert.equal((await call(onRequestPatch, 'b', 'PATCH', {id: first.id, name: 'Stolen'})).status, 404);
  assert.equal((await call(patchCard, 'a', 'PATCH', {storageLocation: 'Binder A', position: 'Page 2', collectionIds: [second.id]}, {id: 'a'})).status, 200);
  groups = (await (await call(onRequestGet, 'a', 'GET')).json()).collections;
  assert.deepEqual(groups.map(group => group.cardIds), [[], ['a']]);
  assert.equal((await call(patchCard, 'b', 'PATCH', {storageLocation: '', collectionIds: [second.id]}, {id: 'b'})).status, 409);
  assert.equal((await call(patchCard, 'a', 'PATCH', {storageLocation: 'Binder A', collectionIds: [second.id], collectionNames: ['Newgroup', 'newgroup', 'FAVORITES']}, {id: 'a'})).status, 200);
  groups = (await (await call(onRequestGet, 'a', 'GET')).json()).collections;
  assert.equal(groups.length, 3);
  assert.ok(groups.every(group => group.cardIds.includes('a')));
  assert.equal((await call(patchCard, 'a', 'PATCH', {storageLocation: '', collectionIds: [], collectionNames: [' '.repeat(3)]}, {id: 'a'})).status, 400);
  assert.equal((await call(patchCard, 'b', 'PATCH', {storageLocation: '', collectionIds: [second.id], collectionNames: ['Notcreated']}, {id: 'b'})).status, 409);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM collections WHERE name = ?').get('Notcreated').n, 0);
  assert.equal((await call(onRequestDelete, 'a', 'DELETE', {id: second.id})).status, 200);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM cards WHERE id = ? AND storage_location_id IS NOT NULL').get('a').n, 1);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM collection_cards WHERE collection_id = ?').get(second.id).n, 0);
  sql.close();
});
