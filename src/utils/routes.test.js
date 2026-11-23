import test from 'node:test';
import assert from 'node:assert/strict';
import {nextRoute} from './routes.js';

test('sign-in return paths use local paths', () => {
  assert.equal(nextRoute('?next=%23%2Fverify%3Fcert%3D123'), '/vault');
  assert.equal(nextRoute('?next=%2Fvault%3Fid%3D123'), '/vault?id=123');
  assert.equal(nextRoute('?next=%2F%2Fexample.com'), '/vault');
  assert.equal(nextRoute('?next=%2Flogin'), '/vault');
});
