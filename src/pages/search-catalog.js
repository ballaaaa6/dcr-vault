import {findCatalogCandidates, getCatalogRarities} from '../store/catalog.js';
import {escapeHTML} from '../utils/format.js';

const FIELDS = ['name', 'setName', 'year', 'cardNumber'];
let version = 0;
let timer;

export function catalogField(id, label, placeholder) {
  const maxLength = id === 'year' ? 4 : id === 'cardNumber' ? 30 : 120;
  const language = ['name', 'setName'].includes(id) ? 'lang="en"' : '';
  return `<div class="form-field"><label for="m-${id}">${label}</label><div class="catalog-control" data-catalog-control="${id}">
    <input class="form-control" id="m-${id}" ${language} data-catalog-field="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="m-${id}-suggestions" autocomplete="off" maxlength="${maxLength}" placeholder="${placeholder}">
    <div class="catalog-suggestions" id="m-${id}-suggestions" role="listbox" hidden></div>
  </div></div>`;
}

function fieldValues() {
  return Object.fromEntries(FIELDS.map(field => [field, document.getElementById(`m-${field}`).value]));
}

export async function populateRarityOptions({setId = '', setName = '', selectedRarity = ''} = {}) {
  const select = document.getElementById('m-rarity');
  if (!select) return;
  const version = Number(select.dataset.optionsVersion || 0) + 1;
  select.dataset.optionsVersion = String(version);
  const hasSet = Boolean(setId || setName.trim());
  if (!hasSet) {
    select.innerHTML = '<option value="">Choose a set first</option>';
    select.value = '';
    select.disabled = true;
    select.dataset.setId = '';
    select.dataset.setName = '';
    return;
  }
  select.innerHTML = '<option value="">Loading set rarities…</option>';
  select.value = '';
  select.disabled = true;
  try {
    const rarityInfo = await getCatalogRarities({setId, setName});
    if (!select.isConnected || select.dataset.optionsVersion !== String(version)) return;
    const {rarities, noPrintedRarity} = rarityInfo;
    const available = rarities.includes(selectedRarity) ? selectedRarity : '';
    const prompt = rarities.length ? 'Choose rarity' : noPrintedRarity ? 'No printed rarity for this set' : 'No catalog rarity recorded';
    select.innerHTML = `<option value="">${prompt}</option>${rarities.map(value =>
      `<option value="${escapeHTML(value)}"${value === available ? ' selected' : ''}>${escapeHTML(value)}</option>`).join('')}`;
    select.value = available;
    select.disabled = rarities.length === 0;
    select.dataset.setId = setId;
    select.dataset.setName = setName;
    if (selectedRarity && !available) {
      const status = document.getElementById('manual-status');
      if (status) status.textContent = 'This card’s rarity is not recorded for the selected set. Choose only a verified value.';
    }
  } catch (error) {
    if (!select.isConnected || select.dataset.optionsVersion !== String(version)) return;
    select.innerHTML = '<option value="">Rarity options unavailable</option>';
    select.value = '';
    select.disabled = true;
    const status = document.getElementById('manual-status');
    if (status) status.textContent = error.message || 'Rarity options are unavailable.';
  }
}

function hideSuggestions(field) {
  const input = document.getElementById(`m-${field}`);
  const list = document.getElementById(`m-${field}-suggestions`);
  if (input) input.setAttribute('aria-expanded', 'false');
  if (list) list.hidden = true;
}

export function hideAllCatalogSuggestions() {
  FIELDS.forEach(hideSuggestions);
}

function renderSuggestions(field, cards, currentVersion) {
  if (currentVersion !== version) return;
  const input = document.getElementById(`m-${field}`);
  const list = document.getElementById(`m-${field}-suggestions`);
  if (!input || !list) return;
  if (!Object.values(fieldValues()).some(value => value.trim())) {
    hideSuggestions(field);
    return;
  }
  input.setAttribute('aria-expanded', 'true');
  list.hidden = false;
  list.innerHTML = cards.length ? cards.map((card, index) => `<button class="catalog-option" role="option" aria-selected="false" id="m-${field}-option-${index}" data-catalog-index="${index}" type="button">
    <strong>${escapeHTML(card.name)}</strong><span>${escapeHTML([card.setName, card.year, card.cardNumber].filter(Boolean).join(' · '))}</span>
  </button>`).join('') : '<p class="catalog-empty">No matching cards. You can keep entering the details manually.</p>';
  list.__cards = cards;
}

async function refreshSuggestions(field) {
  const currentVersion = ++version;
  if (!Object.values(fieldValues()).some(value => value.trim())) {
    hideSuggestions(field);
    return;
  }
  try {
    renderSuggestions(field, await findCatalogCandidates(fieldValues()), currentVersion);
  } catch (error) {
    renderSuggestions(field, [], currentVersion);
    const status = document.getElementById('manual-status');
    if (status) status.textContent = error.message || 'Card suggestions are unavailable.';
  }
}

function selectCard(button, onSelect) {
  const list = button.closest('[role="listbox"]');
  const card = list?.__cards?.[Number(button.dataset.catalogIndex)];
  if (!card) return;
  version += 1;
  document.getElementById('m-name').value = card.name;
  document.getElementById('m-setName').value = card.setName;
  document.getElementById('m-year').value = card.year;
  document.getElementById('m-cardNumber').value = card.cardNumber;
  hideAllCatalogSuggestions();
  onSelect(card);
}

function moveSelection(input, direction) {
  const list = document.getElementById(input.getAttribute('aria-controls'));
  const options = [...(list?.querySelectorAll('[role="option"]') || [])];
  if (!options.length) return;
  const active = options.findIndex(option => option.getAttribute('aria-selected') === 'true');
  const next = (active + direction + options.length) % options.length;
  options.forEach((option, index) => option.setAttribute('aria-selected', String(index === next)));
  input.setAttribute('aria-activedescendant', options[next].id);
}

export function installCatalogSuggestions(onSelect, onEdit = () => {}) {
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
  document.addEventListener('keydown', event => {
    const input = event.target.closest('[data-catalog-field]');
    if (!input) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(input, event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      const list = document.getElementById(input.getAttribute('aria-controls'));
      const active = list?.querySelector('[aria-selected="true"]') || list?.querySelector('[role="option"]');
      if (active) { event.preventDefault(); selectCard(active, onSelect); }
    } else if (event.key === 'Escape') hideSuggestions(input.dataset.catalogField);
  });
  document.addEventListener('click', event => {
    const option = event.target.closest('[data-catalog-index]');
    if (option) selectCard(option, onSelect);
  });
}
