import assert from 'node:assert/strict';
import {test} from 'node:test';
import {closeCatalogOnOutsideClick} from './search-catalog.js';

test('Add Card outside clicks do not close the Vault storage suggestions', () => {
  const events = new EventTarget();
  const previousWindow = globalThis.window;
  globalThis.window = events;
  let closures = 0;
  events.addEventListener('intake-catalog-close', () => { closures += 1; });
  const target = inside => ({closest: () => inside ? {} : null});
  const page = active => ({querySelector: () => active ? {} : null});
  try {
    closeCatalogOnOutsideClick(target(false), page(false));
    assert.equal(closures, 0, 'Vault clicks must not close its suggestions');
    closeCatalogOnOutsideClick(target(true), page(true));
    assert.equal(closures, 0, 'clicking inside an Add Card select keeps it open');
    closeCatalogOnOutsideClick(target(false), page(true));
    assert.equal(closures, 1, 'clicking outside on Add Card closes its suggestions');
  } finally { globalThis.window = previousWindow; }
});
