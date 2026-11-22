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
  globalThis.location = {search: '?cert=12'};
  const markup = verify([{certNumber: '00000012', name: '<Card>', frontImage: '/front'}]);
  assert.match(markup, /value="00000012"/);
  assert.match(markup, /&lt;Card&gt;/);
  assert.match(markup, /Item Information/);
  assert.match(markup, /cert-gallery/);
  assert.match(verify([]), /No record found/);
  globalThis.location.search = '?cert=invalid';
  assert.match(verify([]), /Enter 1 to 8 digits/);
  delete globalThis.location;
});

test('certificate lookup reads the number from the new path', () => {
  globalThis.location = {pathname: '/cert/00000001', search: ''};
  assert.match(verify([{certNumber: '00000001', name: 'First card'}]), /First card/);
  assert.match(verify([{certNumber: '00000002', name: 'Other card'}]), /No record found/);
  globalThis.location.pathname = '/cert/invalid';
  assert.match(verify([]), /Enter 1 to 8 digits/);
  delete globalThis.location;
});
