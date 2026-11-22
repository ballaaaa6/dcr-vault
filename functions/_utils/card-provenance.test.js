import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestPost as create, onRequestGet as list} from '../api/cards.js';
import {onRequestPost as importCards} from '../api/cards/import.js';
import {tokenHash} from './sessions.js';

test('create and import retain provenance; legacy records remain unknown', async () => {
  const sql = new DatabaseSync(':memory:');
  for (const name of ['0001_users_sessions_cards.sql', '0002_card_images.sql', '0003_card_label_metadata.sql',
    '0004_card_source_print_identity.sql', '0005_identification_logs.sql', '0006_card_identification_provenance.sql', '0008_card_artist.sql', '0009_private_vault_details.sql']) {
    sql.exec(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'));
  }
  sql.prepare('INSERT INTO users(id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?)').run('u','g','e',0,0);
  sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .run(await tokenHash('token'), 'u', Math.floor(Date.now()/1000)+1000, 0);
  const DB = {prepare: query => ({bind: (...values) => ({
    first: async () => sql.prepare(query).get(...values) || null,
    all: async () => ({results: sql.prepare(query).all(...values)}),
    run: async () => ({success: true, meta: {changes: Number(sql.prepare(query).run(...values).changes)}})
  })})};
  const req = (path, body) => new Request(`https://vault.test${path}`, {method: body ? 'POST' : 'GET',
    headers: {Cookie: 'dcr_session=token', Origin: 'https://vault.test', 'Content-Type': 'application/json'},
    ...(body ? {body: JSON.stringify(body)} : {})});
  const card = {name:'Mew', setName:'Set', year:'2020', cardNumber:'1', rarity:'Rare', gradeLabel:'Mint', artist:'Artist', notes:'Note', certNumber:'1', identificationStatus:'user_selected', fieldProvenance:{name:'gemini', rarity:'catalog', secret:'user'}};
  assert.equal((await create({request:req('/api/cards',{...card, rarity:''}),env:{DB}})).status,400);
  assert.equal((await create({request:req('/api/cards',card),env:{DB}})).status,201);
  assert.equal((await importCards({request:req('/api/cards/import',{cards:[{name:'Mew',certNumber:'2'}]}),env:{DB}})).status,200);
  const cards = (await (await list({request:req('/api/cards'),env:{DB}})).json()).cards;
  const first = cards.find(x => x.certNumber === '00000001');
  assert.equal(first.artist, 'Artist');
  assert.equal(first.notes, 'Note');
  assert.equal(first.identificationStatus,'user_selected');
  assert.deepEqual(first.fieldProvenance,{name:'gemini',rarity:'catalog'});
  assert.equal(cards.find(x => x.certNumber === '00000002').identificationStatus,'unknown');
  sql.close();
});
