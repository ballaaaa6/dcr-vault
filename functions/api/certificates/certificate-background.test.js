import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from './[cert].js';

test('public certificate returns only the derived background classification', async () => {
  const row = {id: 'card', cert_number: '00000001', category: 'Pokemon', pokemon_types: 'Dragon, Fire'};
  let query = '';
  const env = {DB: {prepare(sql) { query = sql; return {bind() { return {first: async () => row}; }}; }}};
  const response = await onRequestGet({env, params: {cert: '1'}});
  const {card} = await response.json();
  assert.match(query, /pokemon_types/);
  assert.equal(card.backgroundType, 'dragon');
  assert.equal(card.category, undefined);
  assert.equal(card.pokemonTypes, undefined);
});
