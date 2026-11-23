import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogHasMatches, catalogOptions, languageCode, languageName} from './intake-options.js';

const cards = [
  {language: 'en', year: '2025', seriesName: 'Scarlet & Violet', setName: 'Prismatic Evolutions', cardNumber: '006', name: 'Pikachu', rarity: 'Rare', metadata: {}},
  {language: 'en', year: '2017', seriesName: 'Sun & Moon', setName: 'Sun & Moon', cardNumber: '001', name: 'Pikachu', rarity: 'Common', metadata: {}},
  {language: 'ja', year: '2025', seriesName: 'Scarlet & Violet', setName: '日本語', cardNumber: '006', name: 'ピカチュウ', rarity: 'Rare', metadata: {englishSetName: 'Prismatic Evolutions'}}
];

test('options are filtered by other fields in either direction', () => {
  assert.deepEqual(catalogOptions(cards, 'series', {language: 'English', year: '2025', series: ''}), ['Scarlet & Violet']);
  assert.deepEqual(catalogOptions(cards, 'year', {language: 'English', name: 'Pikachu', series: 'Sun & Moon'}), ['2017']);
  assert.deepEqual(catalogOptions(cards, 'setName', {year: '2025', series: 'Sun & Moon'}), []);
  assert.deepEqual(catalogOptions(cards, 'name', {language: 'English', rarity: 'R'}), ['Pikachu']);
  assert.equal(catalogHasMatches(cards, {language: 'English', year: '2025', series: 'Sun & Moon'}), false);
  assert.equal(catalogHasMatches(cards, {language: 'English', cardNumber: '006/165', rarity: 'R'}), true);
});

test('language names and codes map consistently without guessing translated card names', () => {
  assert.equal(languageCode('Japanese'), 'ja');
  assert.equal(languageName('ja'), 'Japanese');
  assert.deepEqual(catalogOptions(cards, 'name', {language: 'Japanese'}), []);
  assert.deepEqual(catalogOptions(cards, 'setName', {language: 'Japanese'}), ['Prismatic Evolutions']);
});
