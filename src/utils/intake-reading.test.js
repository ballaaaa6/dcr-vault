import assert from 'node:assert/strict';
import {test} from 'node:test';
import {intakeValues} from './intake-reading.js';

test('keeps Gemini values when the printed-language catalog has no match', () => {
  const fields = {language: 'th', englishName: 'Charizard', englishSetName: 'Example Set', year: '2021', cardNumber: '168/130', rarity: 'Rare'};
  assert.deepEqual(intakeValues(fields, null), {name: 'Charizard', setName: 'Example Set', year: '2021', cardNumber: '168/130', rarity: 'Rare'});
});

test('prefers verified catalog data and preserves the printed number', () => {
  const fields = {language: 'en', name: 'Mew', setName: 'Reading', year: '2020', cardNumber: '005/100', rarity: 'Rare'};
  assert.deepEqual(intakeValues(fields, {name: 'Mew', setName: 'Catalog', year: '2021', rarity: 'Promo'}),
    {name: 'Mew', setName: 'Catalog', year: '2021', cardNumber: '005/100', rarity: 'Promo'});
});

test('does not put a non-English printed set name in the English form', () => {
  const fields = {language: 'th', name: 'ลิซาร์ดอน', setName: 'ชุดตัวอย่าง', englishName: 'Charizard'};
  assert.equal(intakeValues(fields, {setName: 'ชุดตัวอย่าง'}).setName, '');
});
