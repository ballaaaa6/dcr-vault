import assert from 'node:assert/strict';
import {test} from 'node:test';
import {findExactCatalogCardFromCatalog} from './card-identification-matching.js';

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
