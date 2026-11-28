import test from 'node:test';
import assert from 'node:assert/strict';
import {formatRarity} from './rarity.js';

test('normalizes new and legacy values while preserving full names', () => {
  for (const [input, expected] of Object.entries({'Double Rare': 'RR', DR: 'RR', IR: 'AR', SIR: 'SAR',
    'Mega Hyper Rare': 'MUR', 'Futuristic Rare': 'FUR', P: 'Promo', 'Amazing Rare': 'Amazing Rare'})) {
    assert.equal(formatRarity(input), expected);
  }
});

test('preserves One Piece star marks', () => {
  for (const value of ['SR★', 'R★', 'SEC★★', 'Promo★', 'SR']) assert.equal(formatRarity(value), value);
});
