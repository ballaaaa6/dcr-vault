import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fillMissingCatalogValues, standardLabelValues, catalogDifferences} from './card-identification-helpers.js';

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

test('derives standardized labels from identified game and language', () => {
  assert.deepEqual(standardLabelValues({cardTypeLabel: 'Pokémon Trading Card Game', language: 'ja'}),
    {cardTypeLabel: 'POKÉMON', languageLabel: 'JAPANESE'});
  assert.deepEqual(standardLabelValues({cardTypeLabel: 'Pokémon TCG', language: 'th'}),
    {cardTypeLabel: 'POKÉMON', languageLabel: 'THAI'});
  assert.deepEqual(standardLabelValues({cardTypeLabel: 'Other game', language: 'en'}),
    {cardTypeLabel: '', languageLabel: ''});
  assert.deepEqual(standardLabelValues({cardTypeLabel: 'Pokémon', language: 'ja', uncertainFields: ['game', 'language']}),
    {cardTypeLabel: 'POKÉMON', languageLabel: 'JAPANESE'});
});

test('recognizes the same promo set while flagging different promo codes', () => {
  const source = {language: 'ja', setName: 'XY-P Promos', year: '2015', rarity: 'Promo'};
  const values = {name: 'Rayquaza EX', setName: 'XY-P Promotional cards', year: '2015', rarity: 'Promo'};
  assert.deepEqual(catalogDifferences(values, source), []);
  assert.deepEqual(catalogDifferences({...values, setName: 'SM-P Promos'}, source),
    ['setName: Photo SM-P Promos / catalog XY-P Promos']);
});

test('replaces conflicting Gemini values with matched catalog values and preserves user edits', () => {
  const inputs = {name: {value: 'Lugia'}, setName: {value: 'Aquapolis'}, year: {value: '2003'},
    cardNumber: {value: '149/147'}, rarity: {value: 'Secret Rare'}, artist: {value: 'Custom'}};
  globalThis.document = {getElementById: id => inputs[id.slice(2)]};
  globalThis.window = {dispatchEvent() {}};
  const provenance = {rarity: 'gemini', artist: 'user'};
  fillMissingCatalogValues({language: 'en'}, {language: 'en', name: 'Lugia', setName: 'Aquapolis',
    year: '2003', cardNumber: '149', rarity: 'Rare', metadata: {illustrator: 'Naoyo Kimura'}}, provenance, {});
  assert.equal(inputs.rarity.value, 'R');
  assert.equal(provenance.rarity, 'catalog');
  assert.equal(inputs.cardNumber.value, '149/147');
  assert.equal(inputs.artist.value, 'Custom');
  delete globalThis.document;
  delete globalThis.window;
});
