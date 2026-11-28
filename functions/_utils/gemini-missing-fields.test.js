import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyzeWithGemini} from './gemini-card-reader.js';

const full = {game: 'Pokemon', language: 'Japanese', release_year: '2016', set_name: 'XY-P',
  card_number: '151/XY-P', name: 'Pikachu', rarity: 'PROMO', category: 'Pokemon',
  color_element: ['Lightning'], subtype_detail: '', inferred_fields: ['rarity']};
const response = value => Response.json({candidates: [{content: {parts: [{text: JSON.stringify(value)}]}}]});
const read = callback => analyzeWithGemini({GEMINI_API_KEY: 'test-key'}, new Uint8Array([1, 2]), 'image/jpeg', 'test', callback);

test('complete reading sends one request', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return response(full); };
  try { assert.equal((await read()).rarity, 'PROMO'); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; }
});

test('retries missing normalized fields with the image and keeps existing values', async () => {
  const original = globalThis.fetch; const requests = []; let info;
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return response(requests.length === 1 ? {...full, rarity: '', release_year: '2016?'} : {...full, name: 'Other'});
  };
  try {
    const fields = await read((_raw, review) => { info = review; });
    assert.equal(requests.length, 2);
    assert.equal(requests[1].contents[0].parts[1].inline_data.data, 'AQI=');
    assert.match(requests[1].contents[0].parts[0].text, /release_year, rarity/);
    assert.equal(fields.name, 'Pikachu'); assert.equal(fields.rarity, 'PROMO'); assert.equal(fields.year, '2016');
    assert.deepEqual(fields.inferredFields, ['rarity']);
    assert.deepEqual(info.missingAfter, []);
  } finally { globalThis.fetch = original; }
});

test('returns first partial reading when recovery hits quota', async () => {
  const original = globalThis.fetch; let calls = 0; let info;
  globalThis.fetch = async () => ++calls === 1 ? response({...full, rarity: ''})
    : Response.json({error: {status: 'RESOURCE_EXHAUSTED'}}, {status: 429});
  try {
    const fields = await read((_raw, review) => { info = review; });
    assert.equal(calls, 2); assert.equal(fields.name, 'Pikachu'); assert.equal(fields.rarity, '');
    assert.equal(info.retryOutcome, 'quota'); assert.deepEqual(info.missingAfter, ['rarity']);
  } finally { globalThis.fetch = original; }
});
