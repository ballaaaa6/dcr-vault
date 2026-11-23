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

function identifyRequest() {
  return new Request('https://vault.example.test/api/cards/identify', {
    method: 'POST',
    headers: {Origin: 'https://vault.example.test', 'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'image/jpeg', Cookie: 'dcr_session=test-session'},
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
  });
}

test('Gemini receives a direct identification prompt and returns structured card details', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  const outputFields = {cardTypeLabel: 'POKÉMON', languageLabel: 'JAPANESE', series: 'SCARLET & VIOLET', name: 'ミュウ', setName: 'サンプルセット', setCode: 'SAMPLE', englishName: 'Mew', englishSetName: '', englishCardNumber: '', year: '2024',
    cardNumber: '005/062', language: 'ja', rarity: 'Rare', hp: '60', illustrator: 'Mitsuhiro Arita', stage: 'Basic',
    stamp: '30', setSymbol: 'star', copyrightText: '©2026', types: ['Psychic'], attacks: [{name: 'サイコウェーブ', damage: '30', cost: ['Psychic'], effect: 'Visible attack effect.'}],
    abilities: [], abilityDetails: [{name: 'Ability name', effect: 'Visible ability effect.'}], weaknesses: [],
    resistances: [], retreat: '1', evolvesFrom: '', regulationMark: 'G', printedText: 'Visible footer text.', confidence: {name: 0.98}};
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(outputFields)}]}}]});
  };
  try {
    const result = await analyzeWithGemini({GEMINI_API_KEY: 'test-gemini-key'}, new Uint8Array([1, 2, 3]), 'image/jpeg', 'test-request');
    const prompt = requestBody.contents[0].parts[0].text;
    assert.match(prompt, /First transcribe the printed name/);
    assert.match(prompt, /Cards with the same Pokémon name may be different cards/);
    assert.match(prompt, /needs_review/);
    assert.match(prompt, /identificationSummary/);
    assert.match(prompt, /Pokédex number/);
    assert.doesNotMatch(prompt, /[\u0e00-\u0e7f\u3040-\u30ff]/);
    assert.equal(requestBody.generationConfig.maxOutputTokens, 3072);
    const required = requestBody.generationConfig.responseJsonSchema.required;
    for (const key of ['category', 'trainerType', 'energyKind', 'energyType', 'cardTypeLabel', 'languageLabel', 'series', 'setCode', 'englishCardNumber', 'identificationSummary', 'identityStatus', 'evidence', 'uncertainFields', 'stamp', 'setSymbol', 'copyrightText']) {
      assert.ok(required.includes(key), `schema requires ${key}`);
    }
    assert.deepEqual(result.attacks[0].effects, ['Visible attack effect.']);
    assert.equal(result.setCode, 'SAMPLE');
    assert.equal(result.series, 'SCARLET & VIOLET');
    assert.equal(result.cardTypeLabel, 'POKÉMON');
    assert.equal(result.languageLabel, 'JAPANESE');
    assert.equal(result.stamp, '30');
    assert.equal(result.setSymbol, 'star');
    assert.equal(result.copyrightText, '©2026');
    assert.deepEqual(result.abilityDetails, [{name: 'Ability name', effect: 'Visible ability effect.'}]);
    assert.equal(result.printedText, 'Visible footer text.');
    assert.equal(result.regulationMark, 'G');
    assert.equal(result.category, '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns and logs Trainer and Energy categories', async () => {
  const originalFetch = globalThis.fetch;
  let logged;
  const env = testEnvironment();
  env.DB.prepare = query => query.includes('UPDATE gemini_rotation') ? {first: async () => ({sequence: 0})} : ({bind: (...values) => ({
    first: async () => ({id: 'test-user'}),
    run: async () => { if (query.includes('INSERT INTO identification_logs')) logged = JSON.parse(values[7]); }
  })});
  const samples = [
    {name: 'Gym Trainer', category: 'Trainer', trainerType: 'Supporter', energyKind: '', energyType: ''},
    {name: 'Grass Energy', category: 'Energy', trainerType: '', energyKind: 'Basic', energyType: 'Grass'},
    {name: 'Double Colorless Energy', category: 'Energy', trainerType: '', energyKind: 'Special', energyType: ''}
  ];
  try {
    for (const sample of samples) {
      globalThis.fetch = async () => Response.json({candidates: [{content: {parts: [{text: JSON.stringify(sample)}]}}]});
      const response = await onRequestPost({request: identifyRequest(), env});
      const {fields} = await response.json();
      assert.equal(response.status, 200);
      for (const key of ['category', 'trainerType', 'energyKind', 'energyType']) {
        assert.equal(fields[key], sample[key]);
        assert.equal(logged.raw[key], sample[key]);
        assert.equal(logged.normalized[key], sample[key]);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns a Gemini suggestion even when identity details need manual review', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({url: String(url), init});
    const fields = {name: 'Pikachu', language: 'en',
      identityStatus: 'needs_review', identificationSummary: 'Pikachu, exact print uncertain', evidence: ['HP 60'],
      uncertainFields: ['collector number'], confidence: {name: 0.98, language: 0.98}};
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(fields)}]}}]});
  };
  try {
    const response = await onRequestPost({request: identifyRequest(), env: testEnvironment()});
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.source, 'gemini');
    assert.equal(result.fields.name, 'Pikachu');
    assert.equal(result.fields.identityStatus, 'needs_review');
    assert.equal(result.readingAdequate, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('identification log retains raw and normalized Pokémon types', async () => {
  const originalFetch = globalThis.fetch;
  let logged;
  const env = testEnvironment();
  env.DB.prepare = query => query.includes('UPDATE gemini_rotation') ? {first: async () => ({sequence: 0})} : ({bind: (...values) => ({
    first: async () => ({id: 'test-user'}),
    run: async () => { if (query.includes('INSERT INTO identification_logs')) logged = JSON.parse(values[7]); }
  })});
  globalThis.fetch = async () => Response.json({candidates: [{content: {parts: [
    {text: JSON.stringify({name: 'Vespiquen', types: ['Grass']})}
  ]}}]});
  try {
    const response = await onRequestPost({request: identifyRequest(), env});
    assert.equal(response.status, 200);
    assert.deepEqual(logged.raw.types, ['Grass']);
    assert.deepEqual(logged.normalized.types, ['Grass']);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
