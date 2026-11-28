import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vaultPhoto} from '../components/vault-photo.js';

test('vault disables the corner switch when no corner image exists', () => {
  const empty = vaultPhoto({name: 'Card', frontImage: '/front'});
  assert.match(empty, /vault-corner-switch"[^>]*disabled/);
  const filled = vaultPhoto({name: 'Card', frontImage: '/front', cornerImages: {'back-top-right': '/corner'}});
  assert.doesNotMatch(filled, /vault-corner-switch"[^>]*disabled/);
});
