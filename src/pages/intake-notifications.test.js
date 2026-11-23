import assert from 'node:assert/strict';
import {test} from 'node:test';
import {intakeNotificationType} from './intake-notifications.js';

test('classifies intake notifications by outcome', () => {
  assert.equal(intakeNotificationType('Available as 123.', 'm-cert-status', 'available'), 'success');
  assert.equal(intakeNotificationType('Checking this Cert number…', 'm-cert-status', 'pending'), 'warning');
  assert.equal(intakeNotificationType('123 is already used.', 'm-cert-status', 'error'), 'error');
  assert.equal(intakeNotificationType('Photo selection cleared.', 'photo-status'), 'success');
  assert.equal(intakeNotificationType('Each photo must be 10 MB or smaller.', 'photo-status'), 'error');
  assert.equal(intakeNotificationType('Catalog card selected. Check the details.', 'manual-status'), 'success');
  assert.equal(intakeNotificationType('Complete all required fields.', 'manual-status'), 'error');
  assert.equal(intakeNotificationType('Unexpected server response', 'manual-status', 'error'), 'error');
  assert.equal(intakeNotificationType('Uploading selected photos…', 'manual-status'), 'warning');
});
