import assert from 'node:assert/strict';
import {test} from 'node:test';
import {vaultBackground} from './vault-background.js';

test('selects a known background from each classification and falls back safely', () => {
  assert.equal(vaultBackground({category: 'Pokémon', pokemonTypes: 'Fire, Water'}), 'fire');
  assert.equal(vaultBackground({category: 'Trainer', trainerType: ' Pokémon Tool '}), 'pokemon-tool');
  assert.equal(vaultBackground({category: 'Energy', energyKind: 'Special'}), 'special-energy');
  assert.equal(vaultBackground({category: 'Pokemon', pokemonTypes: 'Unknown'}), 'unknown');
  assert.equal(vaultBackground({}), 'unknown');
});
