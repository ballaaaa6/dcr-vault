import assert from 'node:assert/strict';
import {test} from 'node:test';
import {intakeValues} from './intake-reading.js';

test('does not silently fill unverified set, year or rarity without a catalog match', () => {
  const fields = {language: 'th', englishName: 'Charizard', englishSetName: 'Example Set', year: '2021', cardNumber: '168/130', rarity: 'Rare'};
  assert.deepEqual(intakeValues(fields, null), {name: 'Charizard', setName: '', year: '', cardNumber: '168/130', rarity: ''});
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


test('uses a reviewed English set display for a non-English printing', () => {
  const fields = {language: 'ja', englishName: 'Charizard', cardNumber: '137/103'};
  const source = {setName: '拡張パック', year: '2026', metadata: {englishSetName: '30th CELEBRATION'}};
  assert.equal(intakeValues(fields, source).setName, '30th CELEBRATION');
  assert.equal(intakeValues(fields, source).cardNumber, '137/103');
});


test('fills Promo from promotional identifiers and explicit promo readings', () => {
  for (const fields of [
    {language: 'ja', cardNumber: '151/XY-P'},
    {language: 'ja', cardNumber: '001/S-P'},
    {language: 'en', form: {setName: 'Black Star Promos'}},
    {language: 'en', rarity: 'Promo'}
  ]) assert.equal(intakeValues(fields, null).rarity, 'Promo');
  assert.equal(intakeValues({cardNumber: '151/165'}, null).rarity, '');
  assert.equal(intakeValues({cardNumber: '151/XY-P', form: {rarity: 'Rare'}}, null).rarity, 'Rare');
});

test('keeps uncertain model values blank until the catalog supports them', () => {
  const fields = {language: 'ja', cardNumber: '123/XY-P', englishName: 'Rayquaza EX',
    form: {name: 'Rayquaza EX', setName: 'guess', year: '2015', cardNumber: '123/XY-P', rarity: 'Promo'},
    uncertainFields: ['setName', 'year', 'rarity', 'cardNumber']};
  assert.deepEqual(intakeValues(fields, null), {name: 'Rayquaza EX', setName: '', year: '', cardNumber: '', rarity: ''});
  assert.deepEqual(intakeValues(fields, {setName: 'XY-P Promos', year: '2015', rarity: 'Promo',
    metadata: {verifiedPrintedNumber: '123/XY-P'}}),
  {name: 'Rayquaza EX', setName: 'XY-P Promos', year: '2015', cardNumber: '123/XY-P', rarity: 'Promo'});
  assert.equal(intakeValues({...fields, uncertainFields: ['formSetName']}, null).setName, '');
});
