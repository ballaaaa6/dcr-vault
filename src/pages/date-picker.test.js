import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarOpensUp, datePicker, calendarIcon} from '../components/date-picker.js';

test('calendar opens toward available space', () => {
  assert.equal(calendarOpensUp(50, 86, 300, 800), false);
  assert.equal(calendarOpensUp(650, 686, 300, 800), true);
  assert.equal(calendarOpensUp(220, 256, 500, 400), true);
  assert.equal(calendarOpensUp(100, 136, 500, 400), false);
});

test('date picker uses the shared calendar icon', () => {
  assert.ok(datePicker('', {id: 'test-date'}).includes(calendarIcon));
});
