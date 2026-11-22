import assert from 'node:assert/strict';
import {test} from 'node:test';

test('vault selection updates details without changing the URL and protects unsaved edits', async () => {
  globalThis.window = {};
  globalThis.location = {search: '?id=b'};
  let replaced = '';
  globalThis.history = {state: null, replaceState: (_state, _title, url) => { replaced = url; }};
  const detail = {innerHTML: '', addEventListener() {}};
  const form = {dataset: {}};
  const rows = ['a', 'b'].map(id => ({dataset: {cardId: id}, setAttribute(_name, value) { this.selected = value; }}));
  globalThis.document = {querySelector: () => detail, querySelectorAll: () => rows, getElementById: () => form};
  globalThis.confirm = () => false;
  const {vault, initializeVault} = await import('./vault.js');
  const cards = [{id: 'a', name: 'First', certNumber: '00000001'}, {id: 'b', name: 'Second', certNumber: '00000002'}];
  vault(cards);
  initializeVault();
  assert.equal(replaced, '/vault');
  assert.match(detail.innerHTML, /Second/);
  window.__selectVault('a');
  assert.match(detail.innerHTML, /First/);
  assert.equal(rows[0].selected, 'true');
  assert.equal(replaced, '/vault');
  form.dataset.dirty = 'true';
  window.__selectVault('b');
  assert.match(detail.innerHTML, /First/);
});
