import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGameName} from './card-games.js';

test('normalizes known names without restricting other games', () => {
  assert.equal(normalizeGameName('Pokémon Trading Card Game'), 'Pokémon');
  assert.equal(normalizeGameName('MTG'), 'Magic: The Gathering');
  assert.equal(normalizeGameName('Grand Archive TCG'), 'Grand Archive');
  assert.equal(normalizeGameName('Unknown New Game'), 'Unknown New Game');
  assert.equal(normalizeGameName('OP'), 'OP');
  assert.equal(normalizeGameName('Cyberpunk'), 'Cyberpunk');
  assert.equal(normalizeGameName('One Piece Card Game'), 'One Piece');
  assert.equal(normalizeGameName('Unknown New Game Trading Card Game'), 'Unknown New Game');
  assert.equal(normalizeGameName('TCG'), 'TCG');
  assert.equal(normalizeGameName('未知のゲーム'), '未知のゲーム');
  assert.equal(normalizeGameName('Weiss Schwarz TCG'), 'Weiß Schwarz');
  assert.equal(normalizeGameName('Dragon Ball Super Card Game: Masters'), 'Dragon Ball Super Card Game: Masters');
});
