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
  assert.match(markup, /data-cert="00000012"/);
  assert.match(markup, /data-side="front"/);
  const backMarkup = verify([{certNumber: '00000012', name: 'Card', backImage: '/back'}]);
  assert.match(backMarkup, /data-side="back"/);
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

test('certificate background follows the public classification and clears for missing records', () => {
  globalThis.location = {pathname: '/cert/00000001', search: ''};
  assert.match(verify([{certNumber: '00000001', name: 'Dragon', backgroundType: 'dragon'}]), /cert-background\/dragon\.webp/);
  assert.match(verify([{certNumber: '00000001', name: 'Unknown', backgroundType: '../../bad'}]), /cert-background\/unknown\.webp/);
  assert.doesNotMatch(verify([]), /cert-background/);
  delete globalThis.location;
});


test('certificate details show saved condition, collector number, and full language', () => {
  globalThis.location = {pathname: '/cert/00000001', search: ''};
  const markup = verify([{certNumber: '00000001', name: 'Promo', gradeLabel: 'NEAR MINT',
    game: 'pokemon', year: '2026', setName: 'Promo Set', cardNumber: '151/XY-P', sourceLanguage: 'ja', sourceFinish: 'Holo'}]);
  assert.match(markup, /Cert Number<\/dt><dd>00000001<\/dd><\/div><div><dt>Condition<\/dt><dd>NEAR MINT/);
  assert.match(markup, /Brand\/Title<\/dt><dd>pokemon<\/dd><\/div><div><dt>Year<\/dt><dd>2026/);
  assert.match(markup, /Card Name<\/dt><dd>Promo<\/dd><\/div><div><dt>Set Name<\/dt><dd>Promo Set/);
  assert.match(markup, /Card Number<\/dt><dd>151\/XY-P/);
  assert.match(markup, /Finish<\/dt><dd>Holo<\/dd><\/div><div><dt>Language<\/dt><dd>Japanese<\/dd><\/div><\/dl>/);
  delete globalThis.location;
});
