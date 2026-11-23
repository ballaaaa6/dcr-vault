import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dropdownPlacement} from './dropdown-placement.js';

test('places dropdowns toward available viewport space', () => {
  assert.deepEqual(dropdownPlacement({top: 500, bottom: 540}, 0, 600, 200), {placement: 'top', availableHeight: 487});
  assert.deepEqual(dropdownPlacement({top: 50, bottom: 90}, 0, 600, 200), {placement: 'bottom', availableHeight: 497});
  assert.deepEqual(dropdownPlacement({top: 250, bottom: 290}, 0, 500, 400), {placement: 'top', availableHeight: 237});
  assert.deepEqual(dropdownPlacement({top: 400, bottom: 440}, 300, 400, 150), {placement: 'bottom', availableHeight: 247});
});
