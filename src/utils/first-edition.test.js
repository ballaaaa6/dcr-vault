import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatFirstEdition} from './first-edition.js';

test('formats the set using the latest reading without duplicating suffixes', () => {
  assert.equal(formatFirstEdition('Set', true), 'Set - 1st');
  assert.equal(formatFirstEdition('Set - 1st', true), 'Set - 1st');
  assert.equal(formatFirstEdition('Set - 1st', false), 'Set');
  assert.equal(formatFirstEdition('', true), '');
  assert.equal(formatFirstEdition('x'.repeat(120), true), 'x'.repeat(120));
});
