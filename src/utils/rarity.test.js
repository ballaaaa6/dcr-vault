import test from 'node:test';
import assert from 'node:assert/strict';
import {formatRarity} from './rarity.js';
import {findExactCatalogCardFromCatalog} from './card-identification-matching.js';

test('normalizes new and legacy values while preserving full names', () => {
  for (const [input, expected] of Object.entries({'Double Rare': 'RR', DR: 'RR', IR: 'AR', SIR: 'SAR',
    'Mega Hyper Rare': 'MUR', 'Futuristic Rare': 'FUR', P: 'Promo', 'Amazing Rare': 'Amazing Rare'})) {
    assert.equal(formatRarity(input), expected);
  }
});

test('matches a unique card with conflicting year but refuses ambiguous cards', () => {
  const card = {language: 'en', name: 'Cyndaquil', setName: 'Neo Genesis', year: '2000', cardNumber: '56'};
  assert.equal(findExactCatalogCardFromCatalog([card], {...card, year: '1999'}), card);
  assert.equal(findExactCatalogCardFromCatalog([card, {...card}], {...card, year: '1999'}), null);
});
