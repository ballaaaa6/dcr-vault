import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displaySetName} from './set-name.js';
import {findExactCatalogCardFromCatalog} from './card-identification-matching.js';

test('standardizes anniversary set names without changing unrelated sets', () => {
  for (const name of ['Celebrations', 'Celebrations Classic Collection', '25th Celebrations']) {
    assert.equal(displaySetName(name), '25th Celebration');
  }
  assert.equal(displaySetName('30th CELEBRATION'), '30th Celebration');
  assert.equal(displaySetName('Base Set'), 'Base Set');
});

test('keeps the original catalog identity and refuses ambiguous matches', () => {
  const cards = [
    {id: 'cel25-4', language: 'en', name: 'Pikachu', setName: 'Celebrations', year: '2021', cardNumber: '4'},
    {id: 'cel25cc-4', language: 'en', name: 'Pikachu', setName: 'Celebrations Classic Collection', year: '2021', cardNumber: '4'}
  ];
  const fields = {name: 'Pikachu', setName: '25th Celebration', year: '2021', cardNumber: '4'};
  assert.equal(findExactCatalogCardFromCatalog(cards, fields), null);
  assert.equal(findExactCatalogCardFromCatalog(cards.slice(0, 1), fields).id, 'cel25-4');
});
