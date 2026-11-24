import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setCollections, setLocations} from '../components/vault-locations.js';
import {vaultFilter} from '../components/vault-filter.js';

test('Vault filter displays independent location and collection selections safely', () => {
  setLocations([{id: 'l', name: 'Binder A'}]);
  setCollections([{id: 'c', name: 'Pikachu & friends', cardIds: ['one'], cardCount: 1}]);
  const html = vaultFilter('l', 'c');
  assert.match(html, /Binder A · Pikachu &amp; friends/);
  assert.match(html, /data-manage-locations/);
  assert.match(html, /data-manage-collections/);
  assert.match(html, /aria-checked="true" data-vault-filter="location" data-value="l"/);
  assert.match(html, /aria-checked="true" data-vault-filter="collection" data-value="c"/);
});
