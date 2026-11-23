import {loadCatalogCards} from '../store/catalog.js';
import {catalogHasMatches, catalogOptions} from '../utils/intake-options.js';
import {escapeHTML} from '../utils/format.js';

const FIELDS = ['language', 'year', 'series', 'setName', 'cardNumber', 'name', 'rarity'];
let version = 0;
let timer;

export function catalogField(id, label, placeholder, {wide = false, required = true} = {}) {
  const maxLength = id === 'year' ? 4 : id === 'cardNumber' ? 30 : 120;
  const language = ['name', 'setName'].includes(id) ? 'lang="en"' : '';
  return `<div class="form-field${wide ? ' intake-wide' : ''}"><label for="m-${id}">${label}${required ? ' <span class="required-mark" aria-hidden="true">*</span>' : ''}</label><div class="catalog-control" data-catalog-control="${id}">
    <input class="form-control" id="m-${id}" ${required ? 'required' : ''} ${language} data-catalog-field="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="m-${id}-suggestions" autocomplete="off" maxlength="${maxLength}" placeholder="${placeholder}">
    <button class="catalog-toggle" type="button" data-catalog-toggle="${id}" aria-label="Show ${label} options" tabindex="-1">▾</button>
    <div class="catalog-suggestions" id="m-${id}-suggestions" role="listbox" hidden></div>
  </div></div>`;
}

function fieldValues() {
  return Object.fromEntries(FIELDS.map(field => [field, document.getElementById(`m-${field}`)?.value || '']));
}

function hideSuggestions(field) {
  const input = document.getElementById(`m-${field}`);
  const list = document.getElementById(`m-${field}-suggestions`);
  if (input) { input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
  if (list) list.hidden = true;
}

export function hideAllCatalogSuggestions() { FIELDS.forEach(hideSuggestions); }
export function invalidateCatalogSuggestions() { version += 1; clearTimeout(timer); hideAllCatalogSuggestions(); }

async function refreshSuggestions(field) {
  const currentVersion = ++version;
  FIELDS.filter(item => item !== field).forEach(hideSuggestions);
  const values = fieldValues();
  const input = document.getElementById(`m-${field}`);
  const list = document.getElementById(`m-${field}-suggestions`);
  if (!input || !list) return;
  try {
    const options = catalogOptions(await loadCatalogCards(), field, values);
    if (currentVersion !== version || !input.isConnected) return;
    list.__options = options;
    list.innerHTML = options.length ? options.map((value, index) => `<button class="catalog-option" role="option" aria-selected="false" id="m-${field}-option-${index}" data-catalog-index="${index}" type="button"><strong>${escapeHTML(value)}</strong></button>`).join('')
      : '<p class="catalog-empty">No matching catalog options. You can enter a value manually.</p>';
    input.setAttribute('aria-expanded', 'true');
    list.hidden = false;
  } catch (error) {
    if (currentVersion !== version) return;
    document.getElementById('manual-status').textContent = error.message || 'Card suggestions are unavailable.';
  }
}

function selectOption(button) {
  const list = button.closest('[role="listbox"]');
  const value = list?.__options?.[Number(button.dataset.catalogIndex)];
  const input = list && document.getElementById(list.id.replace('-suggestions', ''));
  if (!input || value === undefined) return;
  input.value = value;
  input.dispatchEvent(new Event('input', {bubbles: true}));
  clearTimeout(timer);
  invalidateCatalogSuggestions();
  input.focus();
}

function moveSelection(input, direction) {
  const list = document.getElementById(input.getAttribute('aria-controls'));
  const options = [...(list?.querySelectorAll('[role="option"]') || [])];
  if (!options.length) { refreshSuggestions(input.dataset.catalogField); return; }
  const active = options.findIndex(option => option.getAttribute('aria-selected') === 'true');
  const next = (active + direction + options.length) % options.length;
  options.forEach((option, index) => option.setAttribute('aria-selected', String(index === next)));
  input.setAttribute('aria-activedescendant', options[next].id);
  options[next].scrollIntoView({block: 'nearest'});
}

export function installCatalogSuggestions(onEdit = () => {}) {
  document.addEventListener('input', event => {
    const input = event.target.closest('[data-catalog-field]');
    if (!input) return;
    onEdit(input.dataset.catalogField);
    clearTimeout(timer);
    timer = setTimeout(() => refreshSuggestions(input.dataset.catalogField), 160);
  });
  document.addEventListener('focusin', event => {
    const input = event.target.closest('[data-catalog-field]');
    if (input) refreshSuggestions(input.dataset.catalogField);
  });
  document.addEventListener('focusout', async event => {
    const input = event.target.closest('[data-catalog-field]');
    if (!input || event.relatedTarget?.closest('[data-catalog-control]')) return;
    const values = fieldValues();
    if (Object.values(values).filter(value => value.trim()).length < 2) return;
    try {
      const cards = await loadCatalogCards();
      if (!input.isConnected || JSON.stringify(fieldValues()) !== JSON.stringify(values) || catalogHasMatches(cards, values)) return;
      const status = document.getElementById('manual-status');
      status.dataset.state = 'warning';
      status.textContent = 'No matching catalog record for these details. You can keep your entries and review them manually.';
    } catch { /* The field remains editable when the catalog is unavailable. */ }
  });
  document.addEventListener('keydown', event => {
    const input = event.target.closest('[data-catalog-field]');
    if (!input) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); moveSelection(input, event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      const active = document.getElementById(input.getAttribute('aria-controls'))?.querySelector('[aria-selected="true"]');
      if (active) { event.preventDefault(); selectOption(active); }
    } else if (event.key === 'Escape') hideSuggestions(input.dataset.catalogField);
  });
  document.addEventListener('click', event => {
    const option = event.target.closest('[data-catalog-index]');
    if (option) { selectOption(option); return; }
    const toggle = event.target.closest('[data-catalog-toggle]');
    if (toggle) { const input = document.getElementById(`m-${toggle.dataset.catalogToggle}`); input.focus(); refreshSuggestions(toggle.dataset.catalogToggle); }
  });
}
