import assert from 'node:assert/strict';
import {test} from 'node:test';
import {bindSignOut} from '../components/sign-out-dialog.js';

function element() {
  return {handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; }};
}

test('logout requires confirmation and allows cancellation and retry', async () => {
  const button = element(), confirm = element(), cancel = element(), status = {};
  const dialog = {...element(), open: false, querySelector: selector => ({'[data-confirm-sign-out]': confirm, '[data-cancel-sign-out]': cancel, '[data-sign-out-status]': status})[selector], showModal() { this.open = true; }, close() { this.open = false; }};
  let calls = 0;
  bindSignOut(button, dialog, async () => { calls++; if (calls === 1) throw new Error('Try again.'); });
  button.handlers.click();
  assert.equal(dialog.open, true);
  assert.equal(calls, 0);
  cancel.handlers.click();
  assert.equal(dialog.open, false);
  button.handlers.click();
  await confirm.handlers.click();
  assert.equal(status.textContent, 'Try again.');
  assert.equal(confirm.disabled, false);
  await confirm.handlers.click();
  assert.equal(calls, 2);
});
