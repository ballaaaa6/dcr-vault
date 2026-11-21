import assert from 'node:assert/strict';
import {test} from 'node:test';
import {onRequestPost} from '../api/cards/identify.js';
import {analyzeWithGemini} from './gemini-card-reader.js';

function testEnvironment() {
  return {
    GEMINI_API_KEY: 'test-gemini-key',
    DB: {prepare: () => ({bind: () => ({first: async () => ({id: 'test-user'})})})}
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
  const outputFields = {name: 'ミュウ', setName: 'サンプルセット', setCode: 'SAMPLE', englishName: 'Mew', englishSetName: '', englishCardNumber: '', year: '2024',
    cardNumber: '005/062', language: 'ja', rarity: 'Rare', hp: '60', illustrator: 'Mitsuhiro Arita', stage: 'Basic',
    types: ['Psychic'], attacks: [{name: 'サイコウェーブ', damage: '30', cost: ['Psychic'], effect: 'Visible attack effect.'}],
    abilities: [], abilityDetails: [{name: 'Ability name', effect: 'Visible ability effect.'}], weaknesses: [],
    resistances: [], retreat: '1', evolvesFrom: '', regulationMark: 'G', printedText: 'Visible footer text.', confidence: {name: 0.98}};
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(outputFields)}]}}]});
  };
  try {
    const result = await analyzeWithGemini({GEMINI_API_KEY: 'test-gemini-key'}, new Uint8Array([1, 2, 3]), 'image/jpeg', 'test-request');
    const prompt = requestBody.contents[0].parts[0].text;
    assert.match(prompt, /Identify the exact Pokémon TCG printing shown/);
    assert.match(prompt, /Cards with the same Pokémon name may be different cards/);
    assert.match(prompt, /needs_review/);
    assert.match(prompt, /identificationSummary/);
    assert.match(prompt, /Pokédex number/);
    assert.doesNotMatch(prompt, /[\u0e00-\u0e7f\u3040-\u30ff]/);
    assert.equal(requestBody.generationConfig.maxOutputTokens, 3072);
    const required = requestBody.generationConfig.responseJsonSchema.required;
    for (const key of ['setCode', 'englishCardNumber', 'identificationSummary', 'identityStatus', 'evidence', 'uncertainFields']) {
      assert.ok(required.includes(key), `schema requires ${key}`);
    }
    assert.deepEqual(result.attacks[0].effects, ['Visible attack effect.']);
    assert.equal(result.setCode, 'SAMPLE');
    assert.deepEqual(result.abilityDetails, [{name: 'Ability name', effect: 'Visible ability effect.'}]);
    assert.equal(result.printedText, 'Visible footer text.');
    assert.equal(result.regulationMark, 'G');
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
