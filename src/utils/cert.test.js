import test from 'node:test';
import assert from 'node:assert/strict';
import {certificateFromPath, certificatePath} from './cert.js';

test('certificate links use padded numbers and recognize certificate paths', () => {
  assert.equal(certificatePath('1'), '/cert/00000001');
  assert.equal(certificatePath('12345678'), '/cert/12345678');
  assert.equal(certificateFromPath('/cert/00000001'), '00000001');
  assert.equal(certificateFromPath('/cert/00000002/'), '00000002');
  assert.equal(certificateFromPath('/verify'), null);
});
