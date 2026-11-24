import {createRoot} from 'react-dom/client';
import {createElement} from 'react';
import {catalogSelect} from './catalog-select.js';
import {getLocations} from './vault-locations.js';

let root = null;
export function unmountLocationInput() { root?.unmount(); root = null; }
export function mountLocationInput(value) {
  root = createRoot(document.getElementById('vault-location-mount'));
  root.render(createElement(catalogSelect, {field: 'storageLocation', label: 'Storage location',
    placeholder: 'Select or enter a location', maxLength: 120, initialValue: value,
    optionsFor: async (field, query) => getLocations().map(item => item.name).filter(name => name.toLowerCase().includes(query.toLowerCase())),
    onEdit: () => {}, onBlur: () => {}}));
}
