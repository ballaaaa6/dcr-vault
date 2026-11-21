import assert from 'node:assert/strict';
import {test} from 'node:test';
import {onRequestPost} from '../api/cards/identify.js';
import {analyzeWithGemini} from './gemini-card-reader.js';

const OCR_TOKEN = 'a'.repeat(64);

function testEnvironment() {
  return {
    GEMINI_API_KEY: 'test-gemini-key',
    ORCL_MEDIA_ORIGIN: 'https://ocr.example.test',
    ORCL_OCR_TOKEN: OCR_TOKEN,
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

function oracleMatchResponse() {
  return Response.json({status: 'matched_preview', scanKeys: {
    keys: {name: 'Mew', set_name: 'Fossil', collector_number: '10/62', language: 'en'},
    confidence: {name: 0.99, set_name: 0.98, collector_number: 0.99, language: 0.99}
  }});
}

test('Gemini receives the complete English prompt and returns structured card text', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  const outputFields = {name: 'ミュウ', setName: 'サンプルセット', englishName: 'Mew', englishSetName: '', year: '2024',
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
    assert.match(prompt, /Read the entire visible Pokémon card face/);
    assert.match(prompt, /collector number with its full denominator/);
    assert.match(prompt, /official English equivalents/);
    assert.match(prompt, /copyright years in printedText/);
    assert.doesNotMatch(prompt, /[\u0e00-\u0e7f\u3040-\u30ff]/);
    assert.equal(requestBody.generationConfig.maxOutputTokens, 3072);
    assert.equal(result.attacks[0].effect, 'Visible attack effect.');
    assert.deepEqual(result.abilityDetails, [{name: 'Ability name', effect: 'Visible ability effect.'}]);
    assert.equal(result.printedText, 'Visible footer text.');
    assert.equal(result.regulationMark, 'G');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('falls back to authenticated Oracle OCR after Gemini network retries fail', async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const calls = [];
  const logs = [];
  const networkError = new TypeError('fetch failed', {cause: Object.assign(new Error('connection reset'), {code: 'ECONNRESET'})});
  globalThis.fetch = async (url, init) => {
    calls.push({url: String(url), init});
    if (String(url).includes('generativelanguage.googleapis.com')) throw networkError;
    return oracleMatchResponse();
  };
  console.warn = (...args) => logs.push(args);
  try {
    const response = await onRequestPost({request: identifyRequest(), env: testEnvironment()});
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.source, 'oracle_ocr');
    assert.equal(result.fields.name, 'Mew');
    assert.equal(result.fields.cardNumber, '10/62');
    const geminiCalls = calls.filter(call => call.url.includes('generativelanguage.googleapis.com'));
    assert.equal(geminiCalls.length, 2);
    assert.ok(geminiCalls.every(call => call.init.redirect === 'manual'));
    const oracleCall = calls.find(call => call.url.endsWith('/ocr/v1/identify'));
    assert.ok(oracleCall);
    assert.equal(oracleCall.init.headers['X-DCR-OCR-Token'], OCR_TOKEN);
    assert.equal(oracleCall.init.redirect, 'manual');
    const logText = JSON.stringify(logs);
    assert.match(logText, /ECONNRESET/);
    assert.doesNotMatch(logText, /test-gemini-key|Mew|10\/62/);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test('returns the correlated Gemini error when both reading services fail', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const originalWarn = console.warn;
  const logs = [];
  const networkError = new TypeError('fetch failed', {cause: Object.assign(new Error('host unreachable'), {code: 'EHOSTUNREACH'})});
  globalThis.fetch = async url => {
    if (String(url).includes('generativelanguage.googleapis.com')) throw networkError;
    return new Response('unavailable', {status: 503});
  };
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
