import {searchIcon} from '../components/search-icon.js';
import {switchIcon, optionsIcon, animateActionIcon} from '../components/action-icons.js';
import {vaultTooltip} from '../components/vault-tooltip.js';
import {compareVaultCards, vaultSortSelect} from '../utils/vault-sort.js';
import {searchClearButton} from '../components/search-clear.js';
import {datePicker, initializeDatePicker} from '../components/date-picker.js';
import {deleteCard, updateCard, getCards} from '../store/cards.js';
import {normalizeGameName} from '../utils/card-games.js';
import {locationsRequest} from '../store/locations.js';
import {collectionsRequest} from '../store/collections.js';
import {vaultFilter, initializeVaultFilter} from '../components/vault-filter.js';
import {mountCollectionInput, unmountCollectionInput} from '../components/vault-collection-input.js';
import {locationDialog, initializeLocations, setLocations, getLocations, setCollections, getCollections} from '../components/vault-locations.js';
import {mountLocationInput, unmountLocationInput} from '../components/vault-location-input.js';
import {listRow} from '../components/card-item.js';
import {heartCheckbox} from '../components/heart-checkbox.js';
import {vaultPhoto, initializeVaultPhoto} from '../components/vault-photo.js';
import {itemInformation} from './verify.js';
import {escapeHTML} from '../utils/format.js';
import {normalizeCert} from '../utils/cert.js';
import {vaultFinishInput, initializeVaultFinish} from '../components/vault-finish.js';
import {vaultBackground, preloadSelectedBackgrounds} from '../utils/vault-background.js';
import {prefetchNearbyImages} from '../utils/prefetch-images.js';
import {confirmDiscard, discardDialog} from '../components/confirm-discard.js';
// Lucide images icon, ISC license: https://lucide.dev/license
const showcaseIcon = () => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="6" y="2" rx="2"/><circle cx="12" cy="8" r="2"/><path d="m22 14-3.8-3.8a2 2 0 0 0-2.8 0L8 18"/><path d="M2 8v12a2 2 0 0 0 2 2h12"/></svg>`;
const sources = ['Facebook', 'Instagram', 'TikTok', 'Shopee', 'Lazada', 'eBay', 'TCGplayer', 'Card shop', 'Card show'];
const currencies = ['THB', 'USD', 'JPY', 'EUR', 'GBP', 'AUD', 'CAD', 'CNY', 'HKD', 'SGD', 'MYR', 'TWD', 'KRW', 'IDR', 'PHP', 'VND', 'CHF', 'NZD'];
let activeCards = [];
let selectedId = '';
let vaultBusy = false;
let bulkSelection = new Set();
const selectableRow = card => `<div class="vault-select-row">${listRow(card)}<label class="vault-row-select">${heartCheckbox(`data-vault-select="${escapeHTML(card.id)}" aria-label="Select ${escapeHTML(card.name)} for deletion" ${bulkSelection.has(card.id) ? 'checked' : ''}`)}</label></div>`;
let stopImagePrefetch = () => {};
let vaultSizeObserver;

function observeVaultSize() {
  vaultSizeObserver?.disconnect();
  const selected = document.querySelector('.vault-selected');
  if (!selected || typeof ResizeObserver === 'undefined') return;
  vaultSizeObserver = new ResizeObserver(() => {
    if (!selected.isConnected) return vaultSizeObserver.disconnect();
    selected.style.setProperty('--vault-selected-height', `${selected.offsetHeight}px`);
  });
  vaultSizeObserver.observe(selected);
}
const publicFields = [
  ['name', 'Card name', 120], ['certNumber', 'Cert number', 8], ['game', 'Brand / Title', 120], ['year', 'Year', 4],
  ['cardTypeLabel', 'Card type', 60],
  ['setName', 'Set name', 120], ['category', 'Category', 40], ['colorElements', 'Colors / elements', 120], ['subtypeDetail', 'Subtype', 60], ['cardNumber', 'Card number', 30], ['rarity', 'Rarity', 80],
  ['gradeLabel', 'Condition', 60], ['sourceFinish', 'Finish', 80]
];
function editFields(card) {
  return publicFields.map(([key, label, limit]) => key === 'sourceFinish' ? vaultFinishInput(card[key]) : `<div class="form-field${key === 'name' ? ' vault-edit-full' : ''}"><div><label for="vault-field-${key}">${label}</label>${vaultTooltip(key, label)}</div>
    <input id="vault-field-${key}" class="form-control" name="${key}" maxlength="${limit}" value="${escapeHTML(Array.isArray(card[key]) ? card[key].join(', ') : card[key] || '')}" ${key === 'certNumber' ? 'inputmode="numeric" pattern="[0-9]{1,8}" required' : key === 'name' ? 'required' : ''}></div>`).join('');
}
export function vault(cards = [], locations = [], collections = []) {
  activeCards = cards;
  bulkSelection = new Set();
  setLocations(locations);
  setCollections(collections);
  if (!cards.length) return `<main class="app-page vault-page"><header class="page-heading vault-heading"><h1>Vault</h1><a class="btn btn-primary vault-showcase" href="/showcase">${showcaseIcon()}<span>My Showcase</span></a></header><div class="vault-toolbar"><div id="location-filter-wrap">${vaultFilter()}</div></div><section class="surface-card empty-state"><p>Your private vault is ready for its first card.</p><a class="btn btn-primary" href="/archive">Add a card</a></section>${locationDialog()}</main>`;
  const params = new URLSearchParams(location.search);
  const sortedCards = [...cards].sort((a, b) => compareVaultCards(a, b, 'date-desc'));
  const focus = cards.find(card => card.id === params.get('id')) || sortedCards[0];
  selectedId = focus.id;
  const rows = sortedCards.map(selectableRow).join('');
  return `
    <main class="app-page vault-page">
      <header class="page-heading vault-heading">
        <h1>Vault</h1>
        <a class="btn btn-primary vault-showcase" href="/showcase">${showcaseIcon()}<span>My Showcase</span></a>
        <p id="vault-count" class="page-description">${cards.length} ${cards.length === 1 ? 'card' : 'cards'} · Prices stay private to your account and never appear on labels.</p>
      </header>
      <form class="vault-toolbar" onsubmit="event.preventDefault(); window.__filterVault()">
        ${vaultSortSelect('vault-sort')}
        <div id="location-filter-wrap">${vaultFilter()}</div>
        <div class="search-bar vault-query">
          <label class="sr-only" for="vault-q">Search your cards</label><input id="vault-q" placeholder="Search name, set or Cert number">
          ${searchClearButton()}
          <button class="search-button" type="submit">${searchIcon()}<span>Search</span></button>
        </div>
      </form>
      <div class="vault-bulk-toolbar"><label class="label-select-all">${heartCheckbox('data-vault-select-all')} Select all</label><div class="vault-bulk-actions" hidden><button class="btn btn-primary" type="button" data-vault-bulk-delete></button><button class="btn btn-ghost" type="button" data-vault-bulk-cancel>Cancel</button></div></div>
      <div class="vault-layout">
        <section class="vault-list" id="vault-list" aria-label="Cards in your vault">${rows}</section>
        <div class="vault-selected" data-vault-art="${vaultBackground(focus)}">
        <aside class="surface-card vault-detail" aria-label="Selected card details">${detailMarkup(focus)}</aside>
        <aside class="surface-card vault-photo-panel" aria-label="Selected card photo">${vaultPhoto(focus)}</aside>
        </div>
      </div>
      <dialog class="vault-delete-dialog two-choice-dialog" aria-labelledby="delete-card-title" aria-describedby="delete-card-description">
        <button class="dialog-close" type="button" data-delete-close aria-label="Close">×</button><h2 id="delete-card-title">Delete this card?</h2>
        <p id="delete-card-description" class="two-choice-description">This card and its photos will be permanently deleted. Its certificate number can be reused.</p>
        <p class="detail-note" data-delete-message role="status"></p>
        <div class="vault-delete-actions two-choice-actions"><button class="btn btn-ghost" type="button" data-delete-cancel autofocus>Cancel</button><button class="btn btn-primary" type="button" data-delete-confirm>Delete card</button></div>
      </dialog>
      ${discardDialog()}
      ${locationDialog()}
    </main>`;
}
function renderLocationFilter() {
  const wrap = document.getElementById('location-filter-wrap');
  if (!wrap) return;
  const current = document.getElementById('vault-location-filter')?.value || '';
  const collection = document.getElementById('vault-collection-filter')?.value || '';
  wrap.innerHTML = vaultFilter(current, collection);
}
async function refreshLocations() {
  const [result, groups, cards] = await Promise.all([locationsRequest(), collectionsRequest(), getCards()]);
  setLocations(result.locations);
  setCollections(groups.collections);
  for (const card of cards) Object.assign(activeCards.find(item => item.id === card.id) || {}, card);
  renderLocationFilter();
  if (selectedId && document.querySelector('.vault-detail')) selectCard(selectedId, 'private');
  if (document.getElementById('vault-q')) window.__filterVault();
}
const privateKeys = ['buyPrice', 'buyCurrency', 'purchaseSource', 'seller', 'receivedDate', 'storageLocation', 'position', 'notes'];
function privateInformation(card) {
  const price = card.buyPrice == null || card.buyPrice === '' ? '-' : `${card.buyPrice} ${card.buyCurrency || 'THB'}`;
  const fields = [['Buy price', price], ['Acquisition', card.purchaseSource], ['Seller', card.seller],
    ['Date received', card.receivedDate], ['Storage location', card.storageLocation], ['Position', card.position], ['Showcases', getCollections().filter(group => group.cardIds.includes(card.id)).map(group => group.name).join(', ')], ['Notes', card.notes]];
  if (card.boughtFrom) fields.push(['Bought from (previous)', card.boughtFrom]);
  return `<section class="cert-information vault-private"><h2>Private vault details</h2><dl>${fields.map(([label, value]) =>
    `<div><dt>${label}</dt><dd>${escapeHTML(value || '-')}</dd></div>`).join('')}</dl></section>`;
}

function privateInputs(card) {
  const source = card.purchaseSource || '';
  const custom = source && !sources.includes(source);
  return `<div class="form-field"><div><span>Buy price</span>${vaultTooltip('buyPrice', 'Buy price')}</div><div class="vault-price-input"><input class="form-control" name="buyPrice" type="number" min="0" step="any" aria-label="Buy price" value="${escapeHTML(card.buyPrice ?? '')}">
    <select class="form-control" name="buyCurrency" aria-label="Currency">${currencies.map(code => `<option value="${code}"${code === (card.buyCurrency || 'THB') ? ' selected' : ''}>${code}</option>`).join('')}</select></div></div>
    <div class="form-field"><div><label for="vault-source">Acquisition</label>${vaultTooltip('purchaseSource', 'Acquisition')}</div><select id="vault-source" class="form-control" name="sourceChoice" onchange="window.__vaultSourceChange(this)"><option value="">Select acquisition</option>${sources.map(value => `<option${value === source ? ' selected' : ''}>${escapeHTML(value)}</option>`).join('')}<option value="Other"${custom ? ' selected' : ''}>Other</option></select></div>
    <div class="form-field" id="vault-custom-source" ${custom ? '' : 'hidden'}><div><label for="vault-custom-source-input">Other acquisition</label>${vaultTooltip('customSource', 'Other acquisition')}</div><input id="vault-custom-source-input" class="form-control" name="customSource" maxlength="120" value="${escapeHTML(custom ? source : '')}"></div>
    <div class="form-field"><div><label for="vault-seller">Seller</label>${vaultTooltip('seller', 'Seller')}</div><input id="vault-seller" class="form-control" name="seller" maxlength="120" value="${escapeHTML(card.seller || '')}"></div>
    ${card.boughtFrom ? `<p class="detail-note">Bought from (previous): ${escapeHTML(card.boughtFrom)}</p>` : ''}
    ${datePicker(card.receivedDate, {help: vaultTooltip('receivedDate', 'Date received')})}
    <div class="form-field"><div><label for="m-storageLocation-input">Storage location</label>${vaultTooltip('storageLocation', 'Storage location')}</div><input type="hidden" id="m-storageLocation" name="storageLocation" value="${escapeHTML(card.storageLocation || '')}"><div id="vault-location-mount"></div></div>
    <div class="form-field"><div><label for="vault-collections-input">Showcases</label>${vaultTooltip('collections', 'Showcases')}</div><input type="hidden" id="vault-collection-values" value="${escapeHTML(JSON.stringify(getCollections().filter(group => group.cardIds.includes(card.id)).map(group => ({id: group.id, name: group.name}))))}"><div id="vault-collection-mount"></div></div>
    <div class="form-field"><div><label for="vault-position">Position</label>${vaultTooltip('position', 'Position')}</div><input id="vault-position" class="form-control" name="position" maxlength="200" value="${escapeHTML(card.position || '')}" placeholder="e.g. Page 3"></div>
    <div class="form-field"><div><label for="vault-notes">Notes</label>${vaultTooltip('notes', 'Notes')}</div><textarea id="vault-notes" class="form-control" name="notes" maxlength="2000" rows="2">${escapeHTML(card.notes || '')}</textarea></div>`;
}

window.__vaultSourceChange = select => {
  document.getElementById('vault-custom-source').hidden = select.value !== 'Other';
};

function detailMarkup(card, mode = 'item') {
  const editing = mode.startsWith('edit-');
  const privateMode = mode === 'private' || mode === 'edit-private';
  return `<div class="vault-detail-controls"><button class="vault-edit-button vault-detail-flip" type="button" onclick="window.__flipVault()" aria-label="${privateMode ? 'Show item information' : 'Show private vault details'}">${switchIcon()}</button>
    <details class="vault-menu dropdown-control" data-dropdown-align="end"><summary class="vault-edit-button" aria-label="Card options">${optionsIcon()}</summary><div class="vault-menu-options dropdown-menu" role="menu">
    <button type="button" role="menuitem" onclick="window.__editVault('card')">Edit card</button><button type="button" role="menuitem" onclick="window.__editVault('private')">Edit private</button><button type="button" role="menuitem" onclick="window.__changeCardDetails()">Change Card Details</button><button class="vault-delete" type="button" role="menuitem" onclick="window.__deleteVault('${escapeHTML(card.id)}')">Delete card</button></div></details></div>
    ${editing ? `<form id="vault-edit" class="vault-edit" data-mode="${mode}" onsubmit="window.__saveDetail(event, '${escapeHTML(card.id)}')">
      <h2>${privateMode ? 'Private vault details' : 'Edit card details'}</h2>
      ${privateMode ? privateInputs(card) : `<div class="vault-edit-grid">${editFields(card)}</div>`}
      <div class="detail-actions"><button class="btn btn-primary" type="submit">Save details</button><button class="btn btn-ghost" type="button" onclick="window.__cancelVault()">Cancel</button></div>
      <p class="detail-note" id="vault-edit-message" role="status"></p></form>` : (privateMode ? privateInformation(card) : itemInformation(card, {showClassification: true}))}`;
}

function selectCard(id, mode = 'item') {
  const card = activeCards.find(item => item.id === id);
  if (!card) return;
  selectedId = id;
  document.querySelector('.vault-selected').dataset.vaultArt = vaultBackground(card);
  document.querySelector('.vault-layout').classList.remove('is-unselected');
  unmountLocationInput();
  unmountCollectionInput();
  document.querySelector('.vault-detail').innerHTML = detailMarkup(card, mode);
  if (mode === 'edit-private') { mountLocationInput(card.storageLocation || ''); mountCollectionInput(card.id); }
  if (mode === 'edit-card') initializeVaultFinish(document.getElementById('vault-edit'));
  document.querySelector('.vault-photo-panel').innerHTML = vaultPhoto(card);
  initializeVaultPhoto(document.querySelector('.vault-photo-panel'));
  initializeDatePicker(document.querySelector('.vault-detail'));
  if (mode.startsWith('edit-')) document.querySelectorAll('#vault-edit input.form-control, #vault-edit select.form-control, #vault-edit textarea.form-control').forEach(updateFilledField);
  document.querySelectorAll('.vault-row').forEach(row => {
    row.setAttribute('aria-pressed', String(row.dataset.cardId === id));
  });
}

window.__selectVault = async id => {
  if (vaultBusy) return;
  const form = document.getElementById('vault-edit');
  if (form?.dataset.dirty === 'true' && !await confirmDiscard()) return;
  if (selectedId === id) {
    selectedId = '';
    document.querySelector('.vault-layout').classList.add('is-unselected');
    document.querySelectorAll('.vault-row').forEach(row => row.setAttribute('aria-pressed', 'false'));
  } else selectCard(id);
};

function closeVaultMenuOnOutsideClick(event) {
  const menu = document.querySelector('.vault-menu[open]');
  if (menu && !menu.contains(event.target)) menu.open = false;
}

function updateFilledField(field) {
  field.classList.toggle('has-value', Boolean(field.value.trim()));
}

export function initializeVault() {
  observeVaultSize();
  initializeVaultFilter(async () => {
    const form = document.getElementById('vault-edit');
    if (form?.dataset.dirty !== 'true') return true;
    if (!await confirmDiscard()) return false;
    selectCard(selectedId, form.dataset.mode === 'edit-private' ? 'private' : 'item');
    return true;
  });
  initializeLocations(refreshLocations, async () => {
    const form = document.getElementById('vault-edit');
    if (form?.dataset.dirty === 'true') {
      if (!await confirmDiscard()) return false;
      selectCard(selectedId, 'private');
    }
    return true;
  }, () => activeCards);
  initializeBulkSelection();
  preloadSelectedBackgrounds(activeCards);
  stopImagePrefetch();
  stopImagePrefetch = prefetchNearbyImages(document.querySelector('#vault-list'));
  document.removeEventListener('click', closeVaultMenuOnOutsideClick);
  document.addEventListener('click', closeVaultMenuOnOutsideClick);
  if (location.search) history.replaceState(history.state, '', '/vault');
  if (selectedId) selectCard(selectedId);
  document.querySelector('.vault-detail')?.addEventListener('input', event => {
    const form = event.target.closest('#vault-edit');
    if (form) {
      form.dataset.dirty = 'true';
      if (event.target.matches('.form-control')) updateFilledField(event.target);
    }
  });
  document.querySelector('.vault-detail')?.addEventListener('change', event => {
    const form = event.target.closest('#vault-edit');
    if (form) {
      form.dataset.dirty = 'true';
      if (event.target.matches('.form-control')) updateFilledField(event.target);
    }
  });
}

window.__filterVault = () => {
  const input = document.getElementById('vault-q');
  const query = input.value.trim().toLowerCase();
  const cert = normalizeCert(query);
  if (cert) input.value = cert;
  const sort = document.getElementById('vault-sort').value;
  const matches = activeCards.filter(card => {
    const searchable = [card.name, card.setName, card.certNumber, card.cardNumber].join(' ').toLowerCase();
    return (!document.getElementById('vault-location-filter')?.value || card.storageLocationId === document.getElementById('vault-location-filter').value) && (!document.getElementById('vault-collection-filter')?.value || getCollections().find(group => group.id === document.getElementById('vault-collection-filter').value)?.cardIds.includes(card.id)) && (!query || (cert ? normalizeCert(card.certNumber) === cert : searchable.includes(query)));
  });
  matches.sort((a, b) => compareVaultCards(a, b, sort));
  const list = document.getElementById('vault-list');
  const count = document.getElementById('vault-count');
  document.querySelector('.vault-layout').classList.toggle('is-empty', !matches.length);
  if (selectedId && matches.length && !matches.some(card => card.id === selectedId)) selectCard(matches[0].id);
  list.innerHTML = matches.length ? matches.map(selectableRow).join('') : '<div class="empty-state">No cards match those filters.</div>';
  stopImagePrefetch();
  stopImagePrefetch = prefetchNearbyImages(list);
  document.querySelectorAll('.vault-row').forEach(row => row.setAttribute('aria-pressed', String(row.dataset.cardId === selectedId)));
  updateBulkSelection();
  count.textContent = `${matches.length} ${matches.length === 1 ? 'card' : 'cards'} shown · ${sort.startsWith('price') ? 'Prices are grouped by currency; no conversion is applied.' : 'Prices stay private to your account and never appear on labels.'}`;
};


async function changeMode(mode) {
  if (vaultBusy) return;
  const form = document.getElementById('vault-edit');
  if (form?.dataset.dirty === 'true' && !await confirmDiscard()) return;
  selectCard(selectedId, mode);
  document.querySelector('#vault-edit input, #vault-edit select')?.focus();
}

window.__flipVault = async () => {
  const isPrivate = !!document.querySelector('.vault-private, #vault-edit[data-mode="edit-private"]');
  await changeMode(isPrivate ? 'item' : 'private');
  animateActionIcon(document.querySelector('.vault-detail-flip'));
};
window.__editVault = mode => changeMode(`edit-${mode}`);
window.__changeCardDetails = async () => {
  if (vaultBusy) return;
  const form = document.getElementById('vault-edit');
  if (form?.dataset.dirty === 'true' && !await confirmDiscard()) return;
  location.href = `/archive?edit=${encodeURIComponent(selectedId)}`;
};
window.__cancelVault = () => changeMode(document.getElementById('vault-edit')?.dataset.mode === 'edit-private' ? 'private' : 'item');

window.__saveDetail = async (event, id) => {
  event.preventDefault();
  if (!id) return;
  if (event.target.dataset.mode === 'edit-card' && !event.target.elements.name.value.trim()) {
    document.getElementById('vault-edit-message').textContent = 'Enter a card name.';
    document.getElementById('vault-field-name')?.focus();
    return;
  }
  const button = document.querySelector('.detail-actions .btn-primary');
  button.disabled = true;
  vaultBusy = true;
  const privateMode = event.target.dataset.mode === 'edit-private';
  const keys = privateMode ? privateKeys.filter(key => key !== 'purchaseSource') : publicFields.map(([key]) => key);
  const patch = Object.fromEntries(keys.map(key => [key, event.target.elements[key].value]));
  if (privateMode) {
    const selected = JSON.parse(document.getElementById('vault-collection-values').value);
    patch.collectionIds = selected.filter(item => item.id).map(item => item.id);
    patch.collectionNames = selected.filter(item => !item.id).map(item => item.name);
  }
  if (privateMode) patch.purchaseSource = event.target.elements.sourceChoice.value === 'Other' ? event.target.elements.customSource.value : event.target.elements.sourceChoice.value;
  if (!privateMode) {
    patch.game = normalizeGameName(patch.game);
    patch.certNumber = normalizeCert(patch.certNumber);
    patch.colorElements = patch.colorElements.split(',').map(value => value.trim()).filter(Boolean);
    const existing = activeCards.find(card => card.id === id);
    patch.inferredFields = (existing.inferredFields || []).filter(field => patch[field === 'set' ? 'setName' : field] === existing[field === 'set' ? 'setName' : field]);
    if (patch.setName !== existing.setName) Object.assign(patch, {setSource: '', setNameLocal: patch.setName, setNameLocalSource: '', setNameEn: '', setNameEnSource: '', setNameEnType: ''});
  }
  try {
    await updateCard(id, patch);
    if (privateMode) {
      const [cards, result, groups] = await Promise.all([getCards(), locationsRequest(), collectionsRequest()]);
      setLocations(result.locations);
      setCollections(groups.collections);
      const updated = cards.find(card => card.id === id);
      Object.assign(activeCards.find(card => card.id === id), updated);
      renderLocationFilter();
    } else Object.assign(activeCards.find(card => card.id === id), patch);
    selectCard(id, privateMode ? 'private' : 'item');
    window.__filterVault();
  } catch (error) {
    document.getElementById('vault-edit-message').textContent = error.message || 'Details could not be saved.';
    button.disabled = false;
  } finally { vaultBusy = false; }
};


function updateBulkSelection() {
  const boxes = [...document.querySelectorAll('[data-vault-select]')];
  const all = document.querySelector('[data-vault-select-all]');
  if (!all) return;
  boxes.forEach(box => { box.checked = bulkSelection.has(box.dataset.vaultSelect); });
  const checked = boxes.filter(box => box.checked).length;
  all.checked = boxes.length > 0 && checked === boxes.length;
  all.indeterminate = checked > 0 && checked < boxes.length;
  all.disabled = !boxes.length || vaultBusy;
  document.querySelector('.vault-bulk-actions').hidden = !bulkSelection.size;
  document.querySelector('[data-vault-bulk-delete]').textContent = `Delete (${bulkSelection.size})`;
}

function initializeBulkSelection() {
  const page = document.querySelector('.vault-page');
  page?.addEventListener('change', event => {
    const box = event.target;
    if (box.matches('[data-vault-select]')) {
      if (box.checked) bulkSelection.add(box.dataset.vaultSelect);
      else bulkSelection.delete(box.dataset.vaultSelect);
    } else if (box.matches('[data-vault-select-all]')) {
      page.querySelectorAll('[data-vault-select]').forEach(item => {
        if (box.checked) bulkSelection.add(item.dataset.vaultSelect);
        else bulkSelection.delete(item.dataset.vaultSelect);
      });
    } else return;
    updateBulkSelection();
  });
  page?.querySelector('[data-vault-bulk-cancel]')?.addEventListener('click', () => { bulkSelection.clear(); updateBulkSelection(); });
  page?.querySelector('[data-vault-bulk-delete]')?.addEventListener('click', confirmBulkDelete);
  updateBulkSelection();
}

function confirmBulkDelete() {
  if (vaultBusy || !bulkSelection.size) return;
  const dialog = document.querySelector('.vault-delete-dialog');
  const count = bulkSelection.size;
  dialog.querySelector('#delete-card-title').textContent = `Delete ${count} selected ${count === 1 ? 'card' : 'cards'}?`;
  dialog.querySelector('#delete-card-description').textContent = 'Cards and photos will be permanently deleted. Certificate numbers can be reused.';
  dialog.querySelector('[data-delete-message]').textContent = '';
  dialog.querySelector('[data-delete-confirm]').textContent = `Delete (${count})`;
  dialog.querySelector('[data-delete-cancel]').onclick = () => dialog.close();
  dialog.querySelector('[data-delete-close]').onclick = () => dialog.close();
  dialog.querySelector('[data-delete-confirm]').onclick = removeBulkCards;
  dialog.oncancel = event => { if (vaultBusy) event.preventDefault(); };
  dialog.onclick = event => { if (event.target === dialog && !vaultBusy) dialog.close(); };
  dialog.showModal();
}

async function removeBulkCards() {
  vaultBusy = true;
  const dialog = document.querySelector('.vault-delete-dialog');
  dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
  const ids = [...bulkSelection];
  const results = await Promise.allSettled(ids.map(id => deleteCard(id)));
  const deleted = new Set(ids.filter((id, index) => results[index].status === 'fulfilled'));
  activeCards = activeCards.filter(card => !deleted.has(card.id));
  deleted.forEach(id => bulkSelection.delete(id));
  vaultBusy = false;
  dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
  if (!activeCards.length) { dialog.close(); location.reload(); return; }
  if (!activeCards.some(card => card.id === selectedId)) selectCard(activeCards[0].id);
  window.__filterVault();
  if (bulkSelection.size) {
    dialog.querySelector('[data-delete-message]').textContent = `${deleted.size} deleted; ${bulkSelection.size} could not be deleted. Please try again.`;
    dialog.querySelector('[data-delete-confirm]').textContent = `Retry (${bulkSelection.size})`;
  } else dialog.close();
}

window.__deleteVault = id => {
  const dialog = document.querySelector('.vault-delete-dialog');
  const cancel = dialog.querySelector('[data-delete-cancel]');
  const confirmButton = dialog.querySelector('[data-delete-confirm]');
  if (vaultBusy) return;
  dialog.querySelector('[data-delete-message]').textContent = '';
  dialog.querySelector('#delete-card-title').textContent = 'Delete this card?';
  dialog.querySelector('#delete-card-description').textContent = 'This card and its photos will be permanently deleted. Its certificate number can be reused.';
  confirmButton.textContent = 'Delete card';
  document.querySelector('.vault-menu').open = false;
  cancel.onclick = () => dialog.close();
  dialog.querySelector('[data-delete-close]').onclick = () => dialog.close();
  confirmButton.onclick = () => removeVaultCard(id);
  dialog.oncancel = event => { if (vaultBusy) event.preventDefault(); };
  dialog.onclick = event => { if (event.target === dialog && !vaultBusy) dialog.close(); };
  dialog.showModal();
};

async function removeVaultCard(id) {
  vaultBusy = true;
  const dialog = document.querySelector('.vault-delete-dialog');
  const buttons = dialog.querySelectorAll('button');
  buttons.forEach(button => { button.disabled = true; });
  try {
    await deleteCard(id);
    dialog.close();
    activeCards = activeCards.filter(card => card.id !== id);
    bulkSelection.delete(id);
    if (activeCards.length) { selectCard(activeCards[0].id); window.__filterVault(); }
    else location.reload();
  } catch (error) {
    dialog.querySelector('[data-delete-message]').textContent = error.message || 'Card could not be deleted.';
  } finally {
    buttons.forEach(button => { button.disabled = false; });
    vaultBusy = false;
  }
}

document.addEventListener('change', event => {
  if (event.target.id === 'vault-sort' || event.target.id === 'vault-location-filter') { if (document.getElementById('vault-q')) window.__filterVault(); }
});
