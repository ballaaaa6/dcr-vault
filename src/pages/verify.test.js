import test from 'node:test';
import assert from 'node:assert/strict';
import {certificateImages, verify} from './verify.js';

test('certificate images prefer only uploaded sides over catalog reference', () => {
  assert.deepEqual(certificateImages({frontImage: '/front', referenceImage: '/reference'}), [['Front', '/front']]);
  assert.deepEqual(certificateImages({backImage: '/back', referenceImage: '/reference'}), [['Back', '/back']]);
  assert.deepEqual(certificateImages({frontImage: '/front', backImage: '/back'}), [['Front', '/front'], ['Back', '/back']]);
  assert.deepEqual(certificateImages({referenceImage: '/reference'}), [['Front · catalog reference', '/reference']]);
  assert.deepEqual(certificateImages({}), []);
});

test('certificate lookup renders a matching record and handles missing records', () => {
  globalThis.location = {hash: '#/verify?cert=12'};
  const markup = verify([{certNumber: '00000012', name: '<Card>', frontImage: '/front'}]);
  assert.match(markup, /value="00000012"/);
  assert.match(markup, /&lt;Card&gt;/);
  assert.match(markup, /Item Information/);
  assert.match(markup, /cert-gallery/);
  assert.match(verify([]), /No record found/);
  globalThis.location.hash = '#/verify?cert=invalid';
  assert.match(verify([]), /Enter 1 to 8 digits/);
  delete globalThis.location;
});
