import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {findEvidenceCatalogCard} from './card-evidence-matching.js';
import {collectorNumbersCompatible} from './card-identification-matching.js';
import {intakeValues} from './intake-reading.js';

const data = JSON.parse(readFileSync(new URL('../../public/data/card-catalog.json', import.meta.url)));
const cards = data.cards.map(([id, language, name, setName, year, cardNumber, rarity, seriesId, setId, seriesName, meta]) => ({
  id, language, name, setName, year, cardNumber, rarity, setId,
  metadata: {nameAliases: meta?.[0] || [], hp: meta?.[2] || '', illustrator: meta?.[3] || '',
    cardCount: meta?.[1] || '', verifiedPrintedCodes: data.verifiedPrintedCodes?.[`${language}:${setId}`]?.codes || []}
}));
const mew = {language: 'ja', name: 'ミュウ', hp: '50', illustrator: 'Ken Sugimori', cardNumber: '151',
  form: {name: 'Mew', year: '1997', cardNumber: '151'}, uncertainFields: ['setName', 'setCode', 'rarity', 'cardNumber']};
const find = fields => findEvidenceCatalogCard(cards, fields, collectorNumbersCompatible);

test('recovers missing Mew fields from the shipped catalog without replacing its printed number', () => {
  const match = find(mew);
  assert.equal(match?.id, 'PMCG3-033');
  assert.deepEqual(intakeValues(mew, match), {name: 'Mew', setName: 'Mystery of the Fossils', year: '1997', cardNumber: '151', rarity: 'Holo Rare'});
});

test('requires corroborating evidence and rejects conflicts or ambiguity', () => {
  for (const change of [{hp: '60'}, {illustrator: ''}, {name: 'ミュウツー'}, {cardNumber: '152'},
    {form: {...mew.form, year: '1998'}}, {uncertainFields: ['hp']}, {stamp: '25th', evidence: ['30th stamp']}]) {
    assert.equal(find({...mew, ...change}), null);
  }
  const match = find(mew);
  assert.equal(findEvidenceCatalogCard([match, {...match, id: 'duplicate', cardNumber: '151'}],
    {...mew, uncertainFields: []}, collectorNumbersCompatible), null);
});

test('matches a compatible printed number when set code is missing and strong evidence is present', () => {
  const card = {id: 'x', language: 'en', name: 'Mew', cardNumber: '5', year: '2020', metadata: {hp: '50', illustrator: 'Artist'}};
  const fields = {language: 'en', name: 'Mew', cardNumber: '5', hp: '50', illustrator: 'Artist'};
  assert.equal(findEvidenceCatalogCard([card], fields, collectorNumbersCompatible), card);
  assert.equal(findEvidenceCatalogCard([card], {...fields, cardNumber: '6'}, collectorNumbersCompatible), null);
  assert.equal(findEvidenceCatalogCard([card], {...fields, uncertainFields: ['cardNumber']}, collectorNumbersCompatible), null);
});

test('uses a matching attack when the printed number is missing, without inventing it', () => {
  const card = {id: 'x', language: 'en', name: 'Mew', cardNumber: '5', year: '2020', rarity: 'Rare',
    metadata: {hp: '50', illustrator: 'Artist', attacks: [{names: ['Psywave']}]}};
  const fields = {language: 'en', name: 'Mew', hp: '50', illustrator: 'Artist', attacks: [{names: ['Psywave']}]};
  assert.equal(findEvidenceCatalogCard([card], fields, collectorNumbersCompatible), card);
  assert.equal(intakeValues(fields, card).cardNumber, '');
  assert.equal(findEvidenceCatalogCard([card], {...fields, attacks: []}, collectorNumbersCompatible), null);
});
