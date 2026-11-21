import test from 'node:test';
import assert from 'node:assert/strict';
import {findVaultImage} from './vault-images.js';

const catalog = [
  {id: 'base1-4', language: 'en', name: 'Charizard', setName: 'Base Set', year: '1999', cardNumber: '4'},
  {id: 'base1-9', language: 'en', name: 'Magneton', setName: 'Base Set', year: '1999', cardNumber: '9'}
];
const sources = {'en:base1-4': 'https://example.com/card.webp'};
const card = {game: 'pokemon', name: 'Charizard', setName: 'Base Set', year: '1999', cardNumber: '#4'};

test('uses an exact identity only when a reference image is indexed', () => {
  assert.equal(findVaultImage(card, catalog, sources), sources['en:base1-4']);
  assert.equal(findVaultImage({...card, name: 'Blastoise', cardNumber: '#9'}, catalog, sources), '');
  assert.equal(findVaultImage(card, catalog, {}), '');
  assert.equal(findVaultImage(card, [...catalog, {...catalog[0], id: 'duplicate'}], sources), '');
});

test('matches an established printed-language identity and rejects conflicting numbers', () => {
  const identified = {...card, name: 'translated', sourceLanguage: 'en', sourceCardId: 'base1-4', identificationStatus: 'matched'};
  assert.equal(findVaultImage(identified, catalog, sources), sources['en:base1-4']);
  assert.equal(findVaultImage({...identified, cardNumber: '9'}, catalog, sources), '');
});
