import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displaySetName} from './set-name.js';

test('standardizes anniversary set names without changing unrelated sets', () => {
  for (const name of ['Celebrations', 'Celebrations Classic Collection', '25th Celebrations']) {
    assert.equal(displaySetName(name), '25th Celebration');
  }
  assert.equal(displaySetName('30th CELEBRATION'), '30th Celebration');
  assert.equal(displaySetName('Base Set'), 'Base Set');
});
