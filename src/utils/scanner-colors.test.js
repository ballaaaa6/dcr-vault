import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scanDotColor, scanLinePosition, tintScanner} from '../components/scanner-colors.js';

const original = JSON.parse(readFileSync(new URL('../components/scanner-original.json', import.meta.url)));

test('scanner removes only grid and background while preserving original dot shapes', () => {
  const result = tintScanner(structuredClone(original));
  assert.deepEqual(result.layers.map(layer => layer.nm), ['Bar', 'Pre-comp 1', 'Trail']);
  assert.deepEqual(result.assets[0].layers.map(layer => layer.nm), ['Shape Layer 3']);
  assert.equal(result.assets[0].layers[0].shapes.length, 38);
});

test('scanner dots brighten with distance and follow the line across both directions', () => {
  assert.ok(scanDotColor(0, 208)[1] < scanDotColor(100, 208)[1]);
  assert.ok(scanDotColor(100, 208)[1] < scanDotColor(208, 208)[1]);
  assert.ok(scanLinePosition(0, 208) < 0.01);
  assert.ok(scanLinePosition(30, 208) > 207.99);
  assert.ok(scanLinePosition(60, 208) < 0.01);
  const dots = tintScanner(structuredClone(original)).assets[0].layers[0].shapes;
  assert.equal(dots[0].it.find(item => item.ty === 'fl').c.k.length, 61);
});
