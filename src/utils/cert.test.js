import test from 'node:test';
import assert from 'node:assert/strict';
import {certificateFromPath, certificatePath, findAvailableCert, publicCertificateUrl} from './cert.js';

test('certificate links use padded numbers and recognize certificate paths', () => {
  assert.equal(certificatePath('1'), '/cert/00000001');
  assert.equal(certificatePath('12345678'), '/cert/12345678');
  assert.equal(certificateFromPath('/cert/00000001'), '00000001');
  assert.equal(certificateFromPath('/cert/00000002/'), '00000002');
  assert.equal(certificateFromPath('/verify'), null);
});

test('label links use the public production site', () => {
  assert.equal(publicCertificateUrl('12'), 'https://dcrcards.pages.dev/cert/00000012');
});


test('random selection skips the current and used numbers before returning an available number', async () => {
  const candidates = ['00000001', '00000002', '00000003'];
  const checked = [];
  const result = await findAvailableCert(async cert => {
    checked.push(cert);
    return {certNumber: cert, available: cert === '00000003'};
  }, '1', () => candidates.shift());
  assert.equal(result, '00000003');
  assert.deepEqual(checked, ['00000002', '00000003']);
});

test('random selection reports failure after bounded unavailable attempts', async () => {
  await assert.rejects(findAvailableCert(async () => ({available: false}), '', () => '00000001'), /Could not find a free number/);
});
