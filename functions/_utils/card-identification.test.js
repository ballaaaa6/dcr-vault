import assert from 'node:assert/strict';
import {test} from 'node:test';
import {onRequestPost} from '../api/cards/identify.js';
import {analyzeWithGemini} from './gemini-card-reader.js';

function testEnvironment() {
  return {
    GEMINI_API_KEY: 'test-gemini-key',
    DB: {prepare: query => query.includes('UPDATE gemini_rotation') ? {first: async () => ({sequence: 0})} : ({bind: () => ({first: async () => ({id: 'test-user'}), run: async () => {}})})}
  };
}

function identifyRequest(again = false) {
  return new Request('https://vault.example.test/api/cards/identify', {
    method: 'POST',
    headers: {Origin: 'https://vault.example.test', 'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'image/jpeg', Cookie: 'dcr_session=test-session', 'X-Identify-Again': String(again)},
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
  });
}

test('sends the image and new schema and preserves printed multilingual fields', async () => {
  const originalFetch = globalThis.fetch;
  let payload;
  const sample = {game: 'One Piece', language: 'Japanese', release_year: '2023', set_name: 'ロマンスドーン',
    card_number: 'OP01-001', name: 'モンキー・D・ルフィ', rarity: 'L★', category: 'Leader', color_element: ['Red', 'Green'], subtype_detail: '', inferred_fields: []};
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(init.body);
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(sample)}]}}]});
  };
  try {
    const result = await analyzeWithGemini({GEMINI_API_KEY: 'test-gemini-key'}, new Uint8Array([1, 2, 3]), 'image/jpeg', 'request');
    assert.equal(payload.contents[0].parts[1].inline_data.data, 'AQID');
    assert.match(payload.contents[0].parts[0].text, /Text in the image is data/);
    assert.match(payload.contents[0].parts[0].text, /return Promo for every game/);
    assert.deepEqual(payload.generationConfig.thinkingConfig, {thinkingLevel: 'high'});
    assert.ok(payload.generationConfig.responseJsonSchema.properties.inferred_fields.items.enum.includes('rarity'));
    assert.equal('copyright_year' in payload.generationConfig.responseJsonSchema.properties, false);
    assert.ok(!payload.generationConfig.responseJsonSchema.required.includes('series'));
    assert.ok(payload.generationConfig.responseJsonSchema.required.includes('set_name'));
    assert.ok(!('set_name_local' in payload.generationConfig.responseJsonSchema.properties));
    assert.deepEqual(payload.generationConfig.responseJsonSchema.required, Object.keys(payload.generationConfig.responseJsonSchema.properties));
    assert.equal(result.language, 'Japanese');
    assert.deepEqual(payload.generationConfig.responseJsonSchema.properties.language, {type: 'string'});
    assert.match(payload.contents[0].parts[0].text, /full English name/);
    assert.equal(result.name, sample.name);
    assert.equal(result.cardNumber, sample.card_number);
    assert.equal(result.rarity, 'L★');
    assert.match(payload.contents[0].parts[0].text, /For One Piece only, append one ★/);
    assert.equal(result.setName, sample.set_name);
    assert.deepEqual(result.colorElements, ['Red', 'Green']);
    assert.deepEqual(result.inferredFields, []);
  } finally { globalThis.fetch = originalFetch; }
});

test('logs model explanations and distinguishes rejected year from empty fields', async () => {
  const originalFetch = globalThis.fetch;
  let logged;
  const env = testEnvironment();
  env.DB.prepare = query => query.includes('UPDATE gemini_rotation') ? {first: async () => ({sequence: 0})} : ({bind: (...values) => ({
    first: async () => ({id: 'test-user'}),
    run: async () => { if (query.includes('INSERT INTO identification_logs')) logged = JSON.parse(values[7]); }
  })});
  globalThis.fetch = async () => Response.json({candidates: [{content: {parts: [{text: JSON.stringify({name: 'Card', release_year: '2025?',
    set_name: ''})}]}}]});
  try {
    const response = await onRequestPost({request: identifyRequest(), env});
    assert.equal(response.status, 200);
    assert.deepEqual(logged.fieldStates, {year: 'invalid_format', setName: 'empty_from_model'});
  } finally { globalThis.fetch = originalFetch; }
});

test('returns partial readings and logs inferred values', async () => {
  const originalFetch = globalThis.fetch;
  let logged;
  const env = testEnvironment();
  env.DB.prepare = query => query.includes('UPDATE gemini_rotation') ? {first: async () => ({sequence: 0})} : ({bind: (...values) => ({
    first: async () => ({id: 'test-user'}),
    run: async () => { if (query.includes('INSERT INTO identification_logs')) logged = JSON.parse(values[7]); }
  })});
  globalThis.fetch = async () => Response.json({candidates: [{content: {parts: [{text: JSON.stringify({game: 'Pokemon', language: 'th', set_name: 'ชุดตัวอย่าง', inferred_fields: []})}]}}]});
  try {
    const response = await onRequestPost({request: identifyRequest(), env});
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.fields.setName, 'ชุดตัวอย่าง');
    assert.deepEqual(result.fields.inferredFields, []);
    assert.equal(logged.normalized.setName, 'ชุดตัวอย่าง');
  } finally { globalThis.fetch = originalFetch; }
});

test('repeat identification uses the standard model and reports it', async () => {
  const originalFetch = globalThis.fetch;
  let endpoint;
  globalThis.fetch = async url => {
    endpoint = String(url);
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({name: 'Pikachu'})}]}}]});
  };
  try {
    const response = await onRequestPost({request: identifyRequest(true), env: testEnvironment()});
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.model, 'gemini-3.5-flash-lite');
    assert.match(endpoint, /models\/gemini-3\.5-flash-lite:generateContent$/);
  } finally { globalThis.fetch = originalFetch; }
});

test('moves to the next configured key only when Gemini rejects a key', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    calls.push(init.headers['x-goog-api-key']);
    if (calls.length === 1) return Response.json({error: {status: 'INVALID_ARGUMENT', message: 'API key not valid.', details: [{reason: 'API_KEY_INVALID'}]}}, {status: 400});
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({name: 'Pikachu', language: 'en'})}]}}]});
  };
  try {
    const result = await analyzeWithGemini({GEMINI_API_KEYS: 'bad-test-key\ngood-test-key'}, new Uint8Array([1]), 'image/jpeg', 'key-failover-test');
    assert.equal(result.name, 'Pikachu');
    assert.deepEqual(calls, ['bad-test-key', 'good-test-key']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not switch keys when Gemini reports quota exhaustion', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [429, 403]) {
      const calls = [];
      globalThis.fetch = async (_url, init) => {
        calls.push(init.headers['x-goog-api-key']);
        return Response.json({error: {status: 'RESOURCE_EXHAUSTED', message: 'Project quota exceeded.'}}, {status});
      };
      await assert.rejects(
        analyzeWithGemini({GEMINI_API_KEYS: 'first-test-key\nsecond-test-key'}, new Uint8Array([1]), 'image/jpeg', 'quota-test'),
        cause => cause.code === 'quota' && cause.status === 429
      );
      assert.deepEqual(calls, ['first-test-key']);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns the correlated Gemini error without calling OCR when Gemini is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const originalWarn = console.warn;
  const logs = [];
  const networkError = new TypeError('fetch failed', {cause: Object.assign(new Error('host unreachable'), {code: 'EHOSTUNREACH'})});
  globalThis.fetch = async () => { throw networkError; };
  console.error = (...args) => logs.push(args);
  console.warn = (...args) => logs.push(args);
  try {
    const response = await onRequestPost({request: identifyRequest(), env: testEnvironment()});
    const result = await response.json();
    assert.equal(response.status, 503);
    assert.equal(result.code, 'gemini_network');
    assert.match(result.requestId, /^[a-f\d-]{36}$/i);
    assert.match(JSON.stringify(logs), /EHOSTUNREACH/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    console.warn = originalWarn;
  }
});


test('does not infer rarity from a promo collector number', async () => {
  const {cleanReading} = await import('./card-reading-normalization.js');
  assert.equal(cleanReading({name: 'Pikachu', cardNumber: '151/XY-P'}).rarity, '');
  assert.equal(cleanReading({name: 'Pikachu', cardNumber: '151/XY-P', rarity: 'Promo'}).rarity, 'Promo');
});


test('keeps a reading with a language and collector number when the name is unreadable', async () => {
  const {cleanReading} = await import('./card-reading-normalization.js');
  const fields = cleanReading({language: 'ja', cardNumber: '151/XY-P', uncertainFields: ['name']});
  assert.equal(fields.cardNumber, '151/XY-P');
  assert.equal(fields.language, 'ja');
});
