import test from 'node:test';
import assert from 'node:assert/strict';
import {showToast, dismissToast} from '../components/toast.js';

test('related updates retain their slot and restart their lifetime', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const children = [];
  const stack = {prepend(toast) { children.unshift(toast); toast.isConnected = true; }};
  const makeToast = () => {
    const parts = Object.fromEntries(['svg', 'strong', '.app-toast-content span', 'button'].map(key => [key, {addEventListener() {}}]));
    return {isConnected: false, classList: {add() {}, remove() {}}, setAttribute() {}, querySelector(key) { return parts[key]; },
      remove() { this.isConnected = false; children.splice(children.indexOf(this), 1); }, parts};
  };
  const oldDocument = globalThis.document;
  globalThis.document = {getElementById: () => stack, createElement: makeToast};
  t.after(() => { dismissToast('test-operation'); globalThis.document = oldDocument; });
  showToast('Working', 'warning', {key: 'test-operation', pending: true});
  const original = children[0];
  t.mock.timers.tick(10000);
  assert.equal(children.length, 1);
  showToast('Done', 'success', {key: 'test-operation'});
  assert.equal(children[0], original);
  assert.equal(original.parts['.app-toast-content span'].textContent, 'Done');
  t.mock.timers.tick(5000);
  assert.equal(children.length, 1);
  showToast('Updated', 'success', {key: 'test-operation'});
  t.mock.timers.tick(5000);
  assert.equal(children.length, 1);
  t.mock.timers.tick(1000);
  assert.equal(children.length, 0);
});
