import {createElement, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Select from 'react-select';
import {getCollections} from './vault-locations.js';

let root;
export function unmountCollectionInput() { root?.unmount(); root = null; }
export function mountCollectionInput(cardId) {
  root = createRoot(document.getElementById('vault-collection-mount'));
  root.render(createElement(CollectionInput, {cardId}));
}

function CollectionInput({cardId}) {
  const options = getCollections().map(item => ({value: item.id, label: item.name}));
  const [selected, setSelected] = useState(options.filter(option => getCollections().find(item => item.id === option.value).cardIds.includes(cardId)));
  return createElement(Select, {inputId: 'vault-collections-input', 'aria-label': 'Collections', isMulti: true,
    options, value: selected, placeholder: 'Select collections', classNamePrefix: 'catalog-select',
    classNames: {menu: () => 'dropdown-menu', option: state => `dropdown-menu-option${state.isFocused ? ' dropdown-menu-option--focused' : ''}`},
    onChange: value => {
      setSelected(value);
      const input = document.getElementById('vault-collection-values');
      input.value = JSON.stringify(value.map(item => item.value));
      input.dispatchEvent(new Event('input', {bubbles: true}));
    }});
}
