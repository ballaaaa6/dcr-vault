import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCertRanges} from './cert-ranges.js';

test('expands and deduplicates certificate ranges in input order', () => {
  assert.deepEqual(parseCertRanges('1-3, 2, 5-6, 00000008'), ['00000001', '00000002', '00000003', '00000005', '00000006', '00000008']);
});

test('rejects malformed, reversed and excessive ranges', () => {
  for (const value of ['', '4-1', '1,,2', '1-100000', '123456789', '1-a']) assert.throws(() => parseCertRanges(value));
  assert.equal(parseCertRanges('99999999')[0], '99999999');
});
