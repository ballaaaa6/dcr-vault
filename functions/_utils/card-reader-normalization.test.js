import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCardReading} from './card-reader-normalization.js';

test('preserves printed multilingual identity and derives inferred set provenance', () => {
  const value = normalizeCardReading({game: 'Pokemon', language: 'th', name: 'ปิกาจู', card_number: '001/100',
    set_name: 'ชุดทดสอบ', inferred_fields: [], category: 'Pokemon', color_element: ['Lightning']});
  assert.equal(value.name, 'ปิกาจู');
  assert.equal(value.cardNumber, '001/100');
  assert.equal(value.setName, 'ชุดทดสอบ');
  assert.deepEqual(value.inferredFields, []);
  assert.deepEqual(value.colorElements, ['Lightning']);
});

test('rejects invalid years while preserving game-neutral classifications for review', () => {
  const value = normalizeCardReading({game: 'One Piece', release_year: '20240', name: 'ルフィ', category: 'Trainer',
    color_element: ['Red', 'Psychic', 'Green', 'Red'], subtype_detail: 'Supporter', inferred_fields: ['year']});
  assert.equal(value.name, 'ルフィ');
  assert.equal(value.year, '');
  assert.equal(value.category, 'Trainer');
  assert.deepEqual(value.colorElements, ['Red', 'Psychic', 'Green', 'Red']);
  assert.equal(value.subtypeDetail, 'Supporter');
  assert.deepEqual(value.inferredFields, []);
});

test('does not assign a classification when the game cannot be identified', () => {
  const value = normalizeCardReading({game: '', name: 'Unknown', category: 'Trainer', color_element: ['Red']});
  assert.equal(value.category, '');
  assert.deepEqual(value.colorElements, []);
});

test('preserves inferred rarity codes and ignores a missing rarity', () => {
  for (const rarity of ['R', 'Promo']) {
    const result = normalizeCardReading({game: 'Pokemon', name: 'Card', rarity, inferred_fields: ['rarity']});
    assert.equal(result.rarity, rarity);
    assert.deepEqual(result.inferredFields, ['rarity']);
  }
  assert.deepEqual(normalizeCardReading({name: 'Card', rarity: '', inferred_fields: ['rarity']}).inferredFields, []);
});


test('preserves local set names and only accepts release years', () => {
  const value = normalizeCardReading({name: 'Card', set_name: '本名', release_year: '2025'});
  assert.equal(value.setName, '本名');
  assert.equal(value.year, '2025');
  assert.equal(normalizeCardReading({name: 'Card', set_name: ''}).setName, '');
});
