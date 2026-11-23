import {createElement, useEffect, useRef, useState} from 'react';
import CreatableSelect from 'react-select/creatable';
import Select from 'react-select';
function DropdownIndicator(props) {
  return createElement('div', {...props.innerProps, className: 'catalog-indicator', 'aria-hidden': true},
    createElement('svg', {width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true},
    createElement('path', {d: 'm8 9 4-4 4 4M8 15l4 4 4-4'})));
}

const selectComponents = {DropdownIndicator};
const selectClassNames = {
  menu: () => 'dropdown-menu',
  option: state => `dropdown-menu-option${state.isFocused ? ' dropdown-menu-option--focused' : ''}${state.isSelected ? ' dropdown-menu-option--selected' : ''}`
};

function useCatalogOptions(field, input, open, optionsFor) {
  const [options, setOptions] = useState([]);
  const latest = useRef(0);
  useEffect(() => {
    if (!open) return undefined;
    const request = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const found = await optionsFor(field, input);
        if (request === latest.current) setOptions(found.map(value => ({value, label: value})));
      } catch { if (request === latest.current) setOptions([]); }
    }, 120);
    return () => { clearTimeout(timer); latest.current += 1; };
  }, [field, input, open, optionsFor]);
  return options;
}

function useExternalValues(field, proxy, current, setSelected, setInput, setOpen) {
  useEffect(() => {
    const sync = () => {
      const value = proxy()?.value || '';
      current.current = value;
      setSelected(value ? {value, label: value} : null);
      setInput('');
    };
    const close = event => { if (event.detail !== field) setOpen(false); };
    window.addEventListener('intake-values-updated', sync);
    window.addEventListener('intake-catalog-close', close);
    return () => { window.removeEventListener('intake-values-updated', sync); window.removeEventListener('intake-catalog-close', close); };
  }, []);
}

export function catalogSelect({field, label, placeholder, maxLength, optionsFor, onEdit, onBlur, restricted = false}) {
  const proxy = () => document.getElementById(`m-${field}`);
  const [selected, setSelected] = useState(null);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const options = useCatalogOptions(field, input, open, optionsFor);
  const current = useRef('');
  useExternalValues(field, proxy, current, setSelected, setInput, setOpen);

  function update(value) {
    const node = proxy();
    if (!node || node.value === value) return;
    node.value = value;
    current.current = value;
    node.dispatchEvent(new Event('input', {bubbles: true}));
    onEdit(field);
  }

  const commit = value => {
    const text = String(value || '').slice(0, maxLength);
    update(text);
    setSelected(text ? {value: text, label: text} : null);
    setInput('');
  };
  const select = createElement(restricted ? Select : CreatableSelect, {
    inputId: `m-${field}-input`, 'aria-label': label, placeholder, options, value: selected,
    inputValue: input, menuIsOpen: open, isClearable: false, classNamePrefix: 'catalog-select', components: selectComponents, classNames: selectClassNames,
    onMenuOpen: () => { window.dispatchEvent(new CustomEvent('intake-catalog-close', {detail: field})); setOpen(true); },
    onMenuClose: () => setOpen(false),
    onChange: option => commit(option?.value),
    onInputChange: (value, action) => {
      if (action.action !== 'input-change') return;
      const text = value.slice(0, maxLength);
      setInput(text);
      if (!restricted) { setSelected(null); update(text); }
    },
    onBlur: () => { commit(current.current); proxy()?.dispatchEvent(new FocusEvent('focusout', {bubbles: true})); onBlur(); },
    noOptionsMessage: () => 'No matching options'
  });
  const clear = selected || input ? createElement('button', {type: 'button', className: 'catalog-clear', 'aria-label': `Clear ${label}`,
    onMouseDown: event => event.preventDefault(), onClick: () => { commit(''); document.getElementById(`m-${field}-input`)?.focus(); }}, '×') : null;
  return createElement('div', {className: `catalog-select-wrap${clear ? ' has-clear has-value' : ''}`}, select, clear);
}
