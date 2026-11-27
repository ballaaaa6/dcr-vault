import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeWithZai} from './zai-card-reader.js';

test('Z.ai reader sends an image and normalizes a JSON reading', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.z.ai/api/paas/v4/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const request = JSON.parse(options.body);
    assert.equal(request.model, 'glm-4.6v-flash');
    assert.match(request.messages[0].content[1].image_url.url, /^data:image\/jpeg;base64,/);
    return Response.json({choices: [{message: {content: JSON.stringify({game: 'Pokemon', name: 'Pikachu', card_number: '025/100'})}}]});
  };
  try {
    const result = await analyzeWithZai({ZAI_API_KEY: 'test-key'}, new Uint8Array([1, 2]), 'image/jpeg', 'test');
    assert.equal(result.name, 'Pikachu');
    assert.equal(result.cardNumber, '025/100');
  } finally { globalThis.fetch = original; }
});

test('Z.ai reader reports rate limits without silently switching providers', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('', {status: 429});
  try {
    await assert.rejects(analyzeWithZai({ZAI_API_KEY: 'test-key'}, new Uint8Array(), 'image/jpeg', 'test'), {code: 'quota'});
  } finally { globalThis.fetch = original; }
});
