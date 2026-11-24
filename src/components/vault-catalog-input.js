import {createRoot} from 'react-dom/client';
import {createElement} from 'react';
import {catalogSelect} from './catalog-select.js';
import {vaultTooltip} from './vault-tooltip.js';
import {loadCatalogCards} from '../store/catalog.js';
import {catalogOptions} from '../utils/intake-options.js';
import {escapeHTML} from '../utils/format.js';

const fields = ['year', 'series', 'setName', 'cardNumber', 'name', 'rarity'];
let roots = [];

export function vaultCatalogField(field, label, limit, value) {
  return `<div class="form-field${field === 'name' ? ' vault-edit-full' : ''}"><div><label for="vault-catalog-${field}-input">${label}</label>${vaultTooltip(field, label)}</div>
    <div class="catalog-control"><input type="hidden" id="vault-catalog-${field}" name="${field}" value="${escapeHTML(value || '')}">
    <div data-vault-catalog="${field}" data-label="${label}" data-limit="${limit}"></div></div></div>`;
}

async function optionsFor(field, query) {
  const cards = await loadCatalogCards();
  const values = Object.fromEntries(fields.map(key => [key, document.getElementById(`vault-catalog-${key}`)?.value || '']));
  values[field] = query;
  const matches = catalogOptions(cards, field, values);
  return matches.length ? matches : catalogOptions(cards, field, {[field]: query});
}

export function unmountVaultCatalog() {
  roots.forEach(root => root.unmount());
  roots = [];
}

export function mountVaultCatalog(card) {
  document.querySelectorAll('[data-vault-catalog]').forEach(element => {
    const field = element.dataset.vaultCatalog;
    const root = createRoot(element);
    root.render(createElement(catalogSelect, {field, label: element.dataset.label, placeholder: `Enter ${element.dataset.label.toLowerCase()}`,
      maxLength: Number(element.dataset.limit), initialValue: card[field] || '', idPrefix: 'vault-catalog', optionsFor,
      onEdit: () => {}, onBlur: () => {}}));
    roots.push(root);
  });
}
