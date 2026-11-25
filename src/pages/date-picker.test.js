import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarOpensUp, datePicker, calendarIcon, dateDuration} from '../components/date-picker.js';

test('calendar opens toward available space', () => {
  assert.equal(calendarOpensUp(50, 86, 300, 800), false);
  assert.equal(calendarOpensUp(650, 686, 300, 800), true);
  assert.equal(calendarOpensUp(220, 256, 500, 400), true);
  assert.equal(calendarOpensUp(100, 136, 500, 400), false);
});

test('date picker uses the shared calendar icon', () => {
  assert.ok(datePicker('', {id: 'test-date'}).includes(calendarIcon));
});


test('date ranges show calendar duration and reject reversed ranges', () => {
  assert.equal(dateDuration('2023-01-10', '2024-03-15'), '1y 2m 5d');
  assert.equal(dateDuration('2024-01-20', '2024-02-19'), '30d');
  assert.equal(dateDuration('2024-01-31', '2024-02-29'), '1m');
  assert.equal(dateDuration('2024-01-01', '2024-02-06'), '1m 5d');
  assert.equal(dateDuration('2024-01-01', '2024-01-01'), '0d');
  assert.equal(dateDuration('2024-03-01', '2024-02-01'), '');
});

test('future dates and range start are configurable per picker', () => {
  const picker = datePicker('', {id: 'end', allowFuture: true, rangeStart: 'start-calendar'});
  assert.match(picker, /data-allow-future="true"/);
  assert.match(picker, /data-range-start="start-calendar"/);
});
