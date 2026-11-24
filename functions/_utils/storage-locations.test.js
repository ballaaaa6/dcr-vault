import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestGet as listCards} from '../api/cards.js';
import {onRequestPatch as patchCard} from '../api/cards/[id].js';
import {onRequestGet, onRequestPost, onRequestPatch, onRequestDelete} from '../api/storage-locations.js';
import {tokenHash} from './sessions.js';

test('locations are private, reusable, renamed together and deleted with optional positions', async () => {
  const sql = new DatabaseSync(':memory:');
  const migrations = ['0001_users_sessions_cards','0002_card_images','0003_card_label_metadata','0004_card_source_print_identity',
    '0005_identification_logs','0006_card_identification_provenance','0008_card_artist','0009_private_vault_details',
    '0010_label_reading_fields','0011_profile_details','0012_collector_profile','0013_card_classification','0014_profile_full_photo','0016_storage_locations','0017_location_order'];
  for (const name of migrations) sql.exec(readFileSync(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8'));
  for (const user of ['a','b']) {
    sql.prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)').run(user,user,user,0,0);
    sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(await tokenHash(user),user,Math.floor(Date.now()/1000)+1000,0);
  }
  for (const id of ['1','2']) sql.prepare('INSERT INTO cards(id,user_id,name,cert_number,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,'a','Card',id.padStart(8,'0'),0,0);
  const DB = {prepare: query => ({bind: (...values) => ({
    first: async () => sql.prepare(query).get(...values) || null,
    all: async () => ({results: sql.prepare(query).all(...values)}),
    run: async () => ({success: true, meta: {changes: Number(sql.prepare(query).run(...values).changes)}})
  })}), batch: async statements => { sql.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); sql.exec('COMMIT'); return result; } catch (error) { sql.exec('ROLLBACK'); throw error; } }};
  const req = (user, method, body) => new Request('https://vault.test/api/storage-locations', {method, headers:{Cookie:`dcr_session=${user}`,Origin:'https://vault.test','Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {})});
  const call = (handler, user, method, body, params) => handler({request:req(user,method,body),env:{DB},params});
  let response = await call(onRequestPost,'a','POST',{name:' Binder A '});
  const location = (await response.json()).location;
  assert.equal(location.name,'Binder A');
  const second = (await (await call(onRequestPost,'a','POST',{name:'Z shelf'})).json()).location;
  assert.equal((await call(onRequestPatch,'a','PATCH',{order:[second.id, location.id]})).status,200);
  assert.deepEqual((await (await call(onRequestGet,'a','GET')).json()).locations.map(item => item.id),[second.id, location.id]);
  assert.equal((await call(onRequestPatch,'b','PATCH',{order:[second.id, location.id]})).status,409);
  assert.equal((await call(onRequestPatch,'a','PATCH',{order:[location.id, location.id]})).status,400);
  assert.equal((await call(onRequestPatch,'a','PATCH',{order:[location.id]})).status,409);
  await call(onRequestDelete,'a','DELETE',{id:second.id,clearPositions:false});
  assert.equal((await call(onRequestPost,'a','POST',{name:'binder a'})).status,409);
  assert.equal((await call(onRequestGet,'b','GET')).status,200);
  assert.deepEqual((await (await call(onRequestGet,'b','GET')).json()).locations,[]);
  for (const id of ['1','2']) assert.equal((await call(patchCard,'a','PATCH',{storageLocation:'binder a',position:`Page ${id}`},{id})).status,200);
  let cards = (await (await call(listCards,'a','GET')).json()).cards;
  assert.ok(cards.every(card => card.storageLocation === 'Binder A' && card.storageLocationId === location.id));
  assert.equal((await (await call(onRequestGet,'a','GET')).json()).locations[0].cardCount,2);
  assert.equal((await call(onRequestPatch,'b','PATCH',{id:location.id,name:'Stolen'})).status,404);
  assert.equal((await call(onRequestPatch,'a','PATCH',{id:location.id,name:'Binder B'})).status,200);
  cards = (await (await call(listCards,'a','GET')).json()).cards;
  assert.ok(cards.every(card => card.storageLocation === 'Binder B'));
  await call(patchCard,'a','PATCH',{storageLocation:'Shelf',position:'Top'},{id:'1'});
  assert.equal((await call(onRequestDelete,'a','DELETE',{id:location.id,clearPositions:false})).status,200);
  cards = (await (await call(listCards,'a','GET')).json()).cards;
  assert.equal(cards.find(card=>card.id==='2').position,'Page 2');
  assert.equal(cards.find(card=>card.id==='2').storageLocation,'');
  const shelf = (await (await call(onRequestGet,'a','GET')).json()).locations.find(item=>item.name==='Shelf');
  await call(onRequestDelete,'a','DELETE',{id:shelf.id,clearPositions:true});
  cards = (await (await call(listCards,'a','GET')).json()).cards;
  assert.equal(cards.find(card=>card.id==='1').position,'');
  assert.equal((await call(onRequestPatch,'a','PATCH',{id:location.id,name:'Missing'})).status,404);
  sql.close();
});
