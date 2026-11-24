import {loadCatalogCards} from '../store/catalog.js';
import {catalogHasMatches, catalogOptions} from '../utils/intake-options.js';

const FIELDS = ['language', 'year', 'series', 'setName', 'cardNumber', 'name', 'rarity'];
let roots = [];
let onEdit = () => {};
let mountVersion = 0;

export function catalogField(id, label, placeholder, {wide = false, required = true} = {}) {
  const maxLength = id === 'year' ? 4 : ['game', 'cardNumber'].includes(id) ? 30 : 120;
  return `<div class="form-field${wide ? ' intake-wide' : ''}"><div class="reading-label"><label for="m-${id}-input">${label}${required ? ' <span class="required-mark" aria-hidden="true">*</span>' : ''}</label><span class="reading-help" hidden><button type="button" class="reading-help-button" aria-label="Why ${label} needs review" aria-describedby="reading-tooltip-${id}" aria-expanded="false">i</button><span id="reading-tooltip-${id}" class="reading-tooltip" role="tooltip">Please review this detail to make sure it’s correct.</span></span></div><div class="catalog-control" data-catalog-control="${id}">
    <input type="hidden" id="m-${id}" ${required ? 'required' : ''} data-catalog-field="${id}">
    <div data-catalog-mount="${id}" data-label="${label}" data-placeholder="${placeholder}" data-maxlength="${maxLength}"></div>
  </div></div>`;
}

function fieldValues() {
  return Object.fromEntries(FIELDS.map(field => [field, document.getElementById(`m-${field}`)?.value || '']));
}

async function optionsFor(field, query) {
  if (field === 'game') return ['Pokémon TCG'];
  return catalogOptions(await loadCatalogCards(), field, {...fieldValues(), [field]: query});
}

async function warnIfUnmatched() {
  const values = fieldValues();
  if (Object.values(values).filter(value => value.trim()).length < 2) return;
  try {
    const cards = await loadCatalogCards();
    if (!document.getElementById('m-language') || JSON.stringify(fieldValues()) !== JSON.stringify(values) || catalogHasMatches(cards, values)) return;
    const status = document.getElementById('manual-status');
    status.dataset.state = 'warning';
    status.textContent = 'No matching catalog record for these details. You can keep your entries and review them manually.';
  } catch { /* Manual entry remains available when the catalog is unavailable. */ }
}

export function invalidateCatalogSuggestions() {
  window.dispatchEvent(new Event('intake-catalog-close'));
}

export function closeCatalogOnOutsideClick(target, root = document) {
  if (root.querySelector('.intake-page') && !target.closest('[data-catalog-control]')) invalidateCatalogSuggestions();
}

export function destroyCatalogSuggestions() {
  mountVersion += 1;
  roots.forEach(root => root.unmount());
  roots = [];
}

export async function initializeCatalogSuggestions() {
  destroyCatalogSuggestions();
  const version = mountVersion;
  const [{createRoot}, {createElement}, {catalogSelect}] = await Promise.all([
    import('react-dom/client'), import('react'), import('../components/catalog-select.js')
  ]);
  if (version !== mountVersion) return;
  document.querySelectorAll('[data-catalog-mount]').forEach(element => {
    const field = element.dataset.catalogMount;
    const root = createRoot(element);
    root.render(createElement(catalogSelect, {field, label: element.dataset.label, placeholder: element.dataset.placeholder,
      maxLength: Number(element.dataset.maxlength), optionsFor, onEdit, onBlur: warnIfUnmatched}));
    roots.push(root);
  });
}

export function installCatalogSuggestions(callback) { onEdit = callback; }
