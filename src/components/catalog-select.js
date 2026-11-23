import {createElement, useEffect, useRef, useState} from 'react';
import CreatableSelect from 'react-select/creatable';

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

export function catalogSelect({field, label, placeholder, maxLength, optionsFor, onEdit, onBlur}) {
  const proxy = () => document.getElementById(`m-${field}`);
  const [selected, setSelected] = useState(null);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const options = useCatalogOptions(field, input, open, optionsFor);
  const current = useRef('');

  function update(value) {
    const node = proxy();
    if (!node || node.value === value) return;
    node.value = value;
    current.current = value;
    node.dispatchEvent(new Event('input', {bubbles: true}));
    onEdit(field);
  }

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

  const commit = value => {
    const text = String(value || '').slice(0, maxLength);
    update(text);
    setSelected(text ? {value: text, label: text} : null);
    setInput('');
  };
  return createElement(CreatableSelect, {
    inputId: `m-${field}-input`, 'aria-label': label, placeholder, options, value: selected,
    inputValue: input, menuIsOpen: open, isClearable: false, classNamePrefix: 'catalog-select',
    onMenuOpen: () => { window.dispatchEvent(new CustomEvent('intake-catalog-close', {detail: field})); setOpen(true); },
    onMenuClose: () => setOpen(false),
    onChange: option => commit(option?.value),
    onInputChange: (value, action) => {
      if (action.action !== 'input-change') return;
      const text = value.slice(0, maxLength);
      setSelected(null); setInput(text); update(text);
    },
    onBlur: () => { commit(current.current); proxy()?.dispatchEvent(new FocusEvent('focusout', {bubbles: true})); onBlur(); },
    noOptionsMessage: () => 'No matching options'
  });
}
