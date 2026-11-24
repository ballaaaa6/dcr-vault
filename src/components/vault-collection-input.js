import {createElement, useState} from 'react';
import {createRoot} from 'react-dom/client';
import CreatableSelect from 'react-select/creatable';
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
  const [inputValue, setInputValue] = useState('');
  function update(value) {
    setSelected(value);
    const input = document.getElementById('vault-collection-values');
    input.value = JSON.stringify(value.map(item => ({id: item.__isNew__ ? '' : item.value, name: item.label})));
    input.dispatchEvent(new Event('input', {bubbles: true}));
  }
  function addTyped() {
    const name = inputValue.trim().slice(0, 120);
    if (!name) return;
    const existing = [...selected, ...options].find(item => item.label.toLowerCase() === name.toLowerCase());
    if (!selected.some(item => item.label.toLowerCase() === name.toLowerCase())) update([...selected, existing || {value: name, label: name, __isNew__: true}]);
    setInputValue('');
  }
  return createElement(CreatableSelect, {inputId: 'vault-collections-input', 'aria-label': 'Collections', isMulti: true,
    options, value: selected, inputValue, placeholder: 'Select or enter collections', classNamePrefix: 'catalog-select',
    classNames: {menu: () => 'dropdown-menu', option: state => `dropdown-menu-option${state.isFocused ? ' dropdown-menu-option--focused' : ''}`},
    onInputChange: (value, action) => { if (action.action === 'input-change') setInputValue(value.slice(0, 120)); },
    isValidNewOption: value => Boolean(value.trim()) && ![...selected, ...options].some(item => item.label.toLowerCase() === value.trim().toLowerCase()),
    onChange: value => { update(value.map(item => item.__isNew__ ? {...item, label: item.label.trim()} : item)); setInputValue(''); }, onBlur: addTyped,
    formatCreateLabel: value => `Create “${value.trim()}”`});
}
