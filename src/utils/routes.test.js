import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyRoute, nextRoute} from './routes.js';

test('legacy links retain their path and query', () => {
  assert.equal(legacyRoute('#/verify?cert=123'), '/verify?cert=123');
  assert.equal(legacyRoute('#/'), '/');
  assert.equal(legacyRoute('#//example.com'), null);
});

test('sign-in return paths support old links and stay local', () => {
  assert.equal(nextRoute('?next=%23%2Fverify%3Fcert%3D123'), '/verify?cert=123');
  assert.equal(nextRoute('?next=%2Fvault%3Fid%3D123'), '/vault?id=123');
  assert.equal(nextRoute('?next=%2F%2Fexample.com'), '/vault');
  assert.equal(nextRoute('?next=%2Flogin'), '/vault');
});
