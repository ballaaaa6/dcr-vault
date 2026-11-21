import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {findExactCatalogCardFromCatalog, findSourceCatalogCardFromCatalog, readingConflicts, collectorNumbersCompatible} from './card-identification-matching.js';

test('matches promo suffix as a set code rather than a numeric card count', () => {
  const card = {cardNumber: '151', setId: 'XY-P', metadata: {cardCount: '200'}};
  assert.equal(collectorNumbersCompatible('151/XY-P', card), true);
  assert.equal(collectorNumbersCompatible('151/SM-P', card), false);
});

test('flags conflicting anniversary descriptions without confusing collector numbers', () => {
  assert.deepEqual(readingConflicts({stamp: '25th Anniversary Pikachu', evidence: ['Pikachu 30 stamp visible']}), ['anniversary stamp']);
  assert.deepEqual(readingConflicts({identificationSummary: 'Card 25/30'}), []);
});

function catalogCard(overrides = {}) {
  return {id: 'sv10-en-5', language: 'en', name: 'Mew', setName: 'Sample Set', year: '2024', cardNumber: '5', rarity: 'Rare Holo', ...overrides};
}

test('links a unique exact English catalog record from a full printed collector number', () => {
  const expected = catalogCard();
  const other = catalogCard({id: 'sv10-en-25', cardNumber: '25'});
  const selected = findExactCatalogCardFromCatalog([expected, other],
    {name: 'Mew', setName: 'Sample Set', year: '2024', cardNumber: '005/062'});

  assert.equal(selected.id, expected.id);
  assert.equal(selected.rarity, 'Rare Holo');
});

test('does not link a card when exact set identity or uniqueness is missing', () => {
  const first = catalogCard();
  const duplicate = catalogCard({id: 'sv10-en-5-alt'});

  assert.equal(findExactCatalogCardFromCatalog([first], {name: 'Mew', setName: 'Other Set', year: '2024', cardNumber: '5'}), null);
  assert.equal(findExactCatalogCardFromCatalog([first, duplicate], {name: 'Mew', setName: 'Sample Set', cardNumber: '5'}), null);
  assert.equal(findExactCatalogCardFromCatalog([first], {name: 'Mew', setName: 'Sample Set'}), null);
});

const japaneseCharizard = {id: 'M6a-137', language: 'ja', name: 'リザードン', setId: 'M6a',
  cardNumber: '137', metadata: {cardCount: '103', hp: '120', nameAliases: []}};

test('finds the original printing using language, set code and full number', () => {
  const fields = {language: 'ja', setCode: 'M6a', cardNumber: '137/103', name: 'リザードン', hp: '120'};
  assert.equal(findSourceCatalogCardFromCatalog([japaneseCharizard], fields), japaneseCharizard);
  assert.equal(findSourceCatalogCardFromCatalog([japaneseCharizard], {...fields, language: 'th'}), null);
  assert.equal(findSourceCatalogCardFromCatalog([japaneseCharizard], {...fields, cardNumber: '137/102'}), null);
  assert.equal(findSourceCatalogCardFromCatalog([japaneseCharizard], {...fields, hp: '130'}), null);
  assert.equal(findSourceCatalogCardFromCatalog([japaneseCharizard], {...fields, uncertainFields: ['collector number']}), null);
});

test('handles promo codes, missing names, and rejects ambiguous records', () => {
  const promo = {id: 'S8a-P-001', language: 'ja', setId: 'S8a-P', cardNumber: '001', metadata: {cardCount: '025'}};
  const fields = {language: 'ja', setCode: 'S8a-P', cardNumber: '001/025'};
  assert.equal(findSourceCatalogCardFromCatalog([promo], fields), promo);
  assert.equal(findSourceCatalogCardFromCatalog([promo, {...promo}], fields), null);
  assert.equal(findSourceCatalogCardFromCatalog([promo], {...fields, setCode: ''}), null);
});

test('does not ignore a known English denominator', () => {
  const card = catalogCard({metadata: {cardCount: '62'}});
  const fields = {name: 'Mew', setName: 'Sample Set', cardNumber: '005/063'};
  assert.equal(findExactCatalogCardFromCatalog([card], fields), null);
});

test('finds the Japanese 30th anniversary Charizard in the shipped catalog', () => {
  const data = JSON.parse(readFileSync(new URL('../../public/data/card-catalog.json', import.meta.url)));
  const cards = data.cards.filter(row => row[1] === 'ja' && row[8] === 'M6a').map(row => ({
    id: row[0], language: row[1], name: row[2], cardNumber: row[5], setId: row[8],
    metadata: {nameAliases: row[10]?.[0] || [], cardCount: row[10]?.[1] || '', hp: row[10]?.[2] || ''}
  }));
  const found = findSourceCatalogCardFromCatalog(cards,
    {language: 'ja', setCode: 'M6a', cardNumber: '137/103', name: 'リザードン', hp: '120'});
  assert.equal(found?.id, 'M6a-137');
});
