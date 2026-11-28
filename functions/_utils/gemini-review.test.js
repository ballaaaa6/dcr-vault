import assert from 'node:assert/strict';
import {test} from 'node:test';
import {reviewWithGemini} from './gemini-card-reader.js';

test('review sends the image and current details with review instructions', async () => {
  const original = globalThis.fetch;
  let payload;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({game: 'Pokemon', name: 'Pikachu', card_number: '025'})}]}}]});
  };
  try {
    const result = await reviewWithGemini({GEMINI_API_KEY: 'test-key'}, new Uint8Array([1, 2]), 'image/jpeg', 'review', {name: 'Pikachu', cardNumber: '026'});
    assert.equal(result.fields.cardNumber, '025');
    assert.match(payload.contents[0].parts[0].text, /"cardNumber":"026"/);
    assert.match(payload.contents[0].parts[0].text, /artwork, layout, and visible symbols/);
    assert.match(payload.contents[0].parts[0].text, /Prioritize clearly visible text and card numbers over visual guesses/);
    assert.match(payload.contents[0].parts[0].text, /use the full official name when identifiable/);
    assert.match(payload.contents[0].parts[0].text, /Preserve abbreviations that are part of the official name/);
    assert.match(payload.contents[0].parts[0].text, /If unsure/);
    assert.equal(payload.contents[0].parts[1].inline_data.data, 'AQI=');
  } finally { globalThis.fetch = original; }
});
