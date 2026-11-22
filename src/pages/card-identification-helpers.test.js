import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fillMissingCatalogValues} from './card-identification-helpers.js';

test('fills only missing catalog fields and preserves edited values', () => {
  const inputs = {setName: {value: ''}, year: {value: '1997'}, rarity: {value: ''}, artist: {value: ''}};
  globalThis.document = {getElementById: id => inputs[id.slice(2)]};
  globalThis.window = {dispatchEvent() {}};
  const provenance = {rarity: 'user'};
  const applied = {};
  fillMissingCatalogValues({language: 'ja'}, {year: '1997', rarity: 'Holo Rare',
    metadata: {englishSetName: 'Mystery of the Fossils', illustrator: 'Ken Sugimori'}}, provenance, applied);
  assert.equal(inputs.setName.value, 'Mystery of the Fossils');
  assert.equal(inputs.rarity.value, '');
  assert.equal(inputs.artist.value, 'Ken Sugimori');
  assert.deepEqual(applied, {setName: 'Mystery of the Fossils', artist: 'Ken Sugimori'});
  assert.equal(provenance.setName, 'catalog');
  delete globalThis.document;
  delete globalThis.window;
});
