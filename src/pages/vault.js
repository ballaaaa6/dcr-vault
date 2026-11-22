import {searchClearButton} from '../components/search-clear.js';
import {datePicker, initializeDatePicker} from '../components/date-picker.js';
import {deleteCard, updateCard} from '../store/cards.js';
import {listRow} from '../components/card-item.js';
import {vaultPhoto, initializeVaultPhoto} from '../components/vault-photo.js';
import {itemInformation} from './verify.js';
import {escapeHTML} from '../utils/format.js';
import {normalizeCert} from '../utils/cert.js';

const sources = ['Facebook', 'Instagram', 'TikTok', 'Shopee', 'Lazada', 'eBay', 'TCGplayer', 'Card shop', 'Card show'];
const currencies = ['THB', 'USD', 'JPY', 'EUR', 'GBP', 'AUD', 'CAD', 'CNY', 'HKD', 'SGD', 'MYR', 'TWD', 'KRW', 'IDR', 'PHP', 'VND', 'CHF', 'NZD'];
let activeCards = [];
let selectedId = '';
let vaultBusy = false;

const publicFields = [
  ['certNumber', 'Cert number', 8], ['name', 'Card name', 120], ['game', 'Brand / Title', 30], ['year', 'Year', 4],
  ['cardTypeLabel', 'Card type', 60], ['series', 'Series', 120], ['languageLabel', 'Language label', 60],
  ['setName', 'Set name', 120], ['cardNumber', 'Card number', 30], ['rarity', 'Rarity', 80],
  ['gradeLabel', 'Condition', 60], ['sourceFinish', 'Finish', 30], ['sourceLanguage', 'Language code', 20]
];

function editFields(card) {
  return publicFields.map(([key, label, limit]) => `<label class="form-field"><span>${label}</span>
    <input class="form-control" name="${key}" maxlength="${limit}" value="${escapeHTML(card[key] || '')}" ${key === 'certNumber' ? 'inputmode="numeric" pattern="[0-9]{1,8}" required' : key === 'name' ? 'required' : ''}></label>`).join('');
}

export function vault(cards = []) {
  activeCards = cards;
  if (!cards.length) return '<main class="app-page vault-page"><section class="surface-card empty-state"><h1>My Vault</h1><p>Your private vault is ready for its first card.</p><a class="btn btn-primary" href="/register">Add a card</a></section></main>';
  const params = new URLSearchParams(location.search);
  const sortedCards = [...cards].sort((a, b) => compareVaultCards(a, b, 'date-desc'));
  const focus = cards.find(card => card.id === params.get('id')) || sortedCards[0];
  selectedId = focus.id;
  const rows = sortedCards.map(listRow).join('');

  return `
    <main class="app-page vault-page">
      <header class="page-heading vault-heading">

        <h1>My Vault</h1>
        <p id="vault-count" class="page-description">${cards.length} ${cards.length === 1 ? 'card' : 'cards'} · Prices stay private to your account and never appear on labels.</p>
      </header>
      <form class="vault-toolbar" onsubmit="event.preventDefault(); window.__filterVault()">
        <label class="vault-status"><span class="sr-only">Sort by</span><select id="vault-sort" class="form-control" onchange="window.__filterVault()"><option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option><option value="price-desc">Price: High to Low</option><option value="price-asc">Price: Low to High</option><option value="date-asc">Date: Oldest First</option><option value="date-desc" selected>Date: Newest First</option></select></label>
        <div class="search-bar vault-query">
          <label class="sr-only" for="vault-q">Search your cards</label><input id="vault-q" placeholder="Search name, set or Cert number">
          ${searchClearButton()}
          <button class="search-button" type="submit"><span>Search</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.3"></circle><path d="m15.5 15.5 4.2 4.2"></path></svg></button>
        </div>
      </form>
      <div class="vault-layout">
        <section class="vault-list" id="vault-list" aria-label="Cards in your vault">${rows}</section>
        <div class="vault-selected">
        <aside class="surface-card vault-detail" aria-label="Selected card details">${detailMarkup(focus)}</aside>
        <aside class="surface-card vault-photo-panel" aria-label="Selected card photo">${vaultPhoto(focus)}</aside>
        </div>
      </div>
      <dialog class="vault-delete-dialog" aria-labelledby="delete-card-title" aria-describedby="delete-card-description">
        <h2 id="delete-card-title">Delete this card?</h2>
        <p id="delete-card-description">This will permanently delete the card and its photos. Its certificate number will be available for another card.</p>
        <p class="detail-note" data-delete-message role="status"></p>
        <div class="vault-delete-actions"><button class="btn btn-ghost" type="button" data-delete-cancel autofocus>Cancel</button><button class="btn btn-primary" type="button" data-delete-confirm>Delete card</button></div>
      </dialog>
    </main>`;
}

const flipIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-5V2M4 17h5v5M20 7a8 8 0 0 0-14-2M4 17a8 8 0 0 0 14 2"/></svg>';
const privateKeys = ['buyPrice', 'buyCurrency', 'purchaseSource', 'seller', 'receivedDate', 'notes'];

function privateInformation(card) {
  const price = card.buyPrice == null || card.buyPrice === '' ? '-' : `${card.buyPrice} ${card.buyCurrency || 'THB'}`;
  const fields = [['Buy price', price], ['Acquisition', card.purchaseSource], ['Seller', card.seller],
    ['Date received', card.receivedDate], ['Notes', card.notes]];
  if (card.boughtFrom) fields.push(['Bought from (previous)', card.boughtFrom]);
  return `<section class="cert-information vault-private"><h2>Private vault details</h2><dl>${fields.map(([label, value]) =>
    `<div><dt>${label}</dt><dd>${escapeHTML(value || '-')}</dd></div>`).join('')}</dl></section>`;
}

function privateInputs(card) {
  const source = card.purchaseSource || '';
  const custom = source && !sources.includes(source);
  return `<div class="form-field"><span>Buy price</span><div class="vault-price-input"><input class="form-control" name="buyPrice" type="number" min="0" step="any" aria-label="Buy price" value="${escapeHTML(card.buyPrice ?? '')}">
    <select class="form-control" name="buyCurrency" aria-label="Currency">${currencies.map(code => `<option value="${code}"${code === (card.buyCurrency || 'THB') ? ' selected' : ''}>${code}</option>`).join('')}</select></div></div>
    <label class="form-field"><span>Acquisition</span><select class="form-control" name="sourceChoice" onchange="window.__vaultSourceChange(this)"><option value="">Select acquisition</option>${sources.map(value => `<option${value === source ? ' selected' : ''}>${escapeHTML(value)}</option>`).join('')}<option value="Other"${custom ? ' selected' : ''}>Other</option></select></label>
    <label class="form-field" id="vault-custom-source" ${custom ? '' : 'hidden'}><span>Other acquisition</span><input class="form-control" name="customSource" maxlength="120" value="${escapeHTML(custom ? source : '')}"></label>
    <label class="form-field"><span>Seller</span><input class="form-control" name="seller" maxlength="120" value="${escapeHTML(card.seller || '')}"></label>
    ${card.boughtFrom ? `<p class="detail-note">Bought from (previous): ${escapeHTML(card.boughtFrom)}</p>` : ''}
    ${datePicker(card.receivedDate)}
    <label class="form-field"><span>Notes</span><textarea class="form-control" name="notes" maxlength="2000" rows="3">${escapeHTML(card.notes || '')}</textarea></label>`;
}

window.__vaultSourceChange = select => {
  document.getElementById('vault-custom-source').hidden = select.value !== 'Other';
};

function detailMarkup(card, mode = 'item') {
  const editing = mode.startsWith('edit-');
  const privateMode = mode === 'private' || mode === 'edit-private';
  return `<div class="vault-detail-controls"><button class="vault-edit-button vault-detail-flip" type="button" onclick="window.__flipVault()" aria-label="${privateMode ? 'Show item information' : 'Show private vault details'}" title="Switch details">${flipIcon}</button>
    <details class="vault-menu"><summary class="vault-edit-button" aria-label="Card options" title="Card options">⋯</summary><div class="vault-menu-options">
    <button type="button" onclick="window.__editVault('card')">Edit card</button><button type="button" onclick="window.__editVault('private')">Edit private</button><button class="vault-delete" type="button" onclick="window.__deleteVault('${escapeHTML(card.id)}')">Delete card</button></div></details></div>
    ${editing ? `<form id="vault-edit" class="vault-edit" data-mode="${mode}" onsubmit="window.__saveDetail(event, '${escapeHTML(card.id)}')">
      <h2>${privateMode ? 'Private vault details' : 'Edit card details'}</h2>
      <p class="detail-note">${privateMode ? 'Prices and vault details are private.' : 'These card details appear on the public certificate.'}</p>
      ${privateMode ? privateInputs(card) : `<div class="vault-edit-grid">${editFields(card)}</div>`}
      <div class="detail-actions"><button class="btn btn-primary" type="submit">Save details</button><button class="btn btn-ghost" type="button" onclick="window.__cancelVault()">Cancel</button></div>
      <p class="detail-note" id="vault-edit-message" role="status"></p></form>` : (privateMode ? privateInformation(card) : itemInformation(card))}`;
}

function selectCard(id, mode = 'item') {
  const card = activeCards.find(item => item.id === id);
  if (!card) return;
  selectedId = id;
  document.querySelector('.vault-layout').classList.remove('is-unselected');
  document.querySelector('.vault-detail').innerHTML = detailMarkup(card, mode);
  document.querySelector('.vault-photo-panel').innerHTML = vaultPhoto(card);
  initializeVaultPhoto(document.querySelector('.vault-photo-panel'));
  initializeDatePicker(document.querySelector('.vault-detail'));
  document.querySelectorAll('.vault-row').forEach(row => {
    row.setAttribute('aria-pressed', String(row.dataset.cardId === id));
  });
}

window.__selectVault = id => {
  if (vaultBusy) return;
  const form = document.getElementById('vault-edit');
  if (form?.dataset.dirty === 'true' && !confirm('Discard unsaved changes?')) return;
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

export function initializeVault() {
  document.removeEventListener('click', closeVaultMenuOnOutsideClick);
  document.addEventListener('click', closeVaultMenuOnOutsideClick);
  if (location.search) history.replaceState(history.state, '', '/vault');
  if (selectedId) selectCard(selectedId);
  document.querySelector('.vault-detail')?.addEventListener('input', event => {
    const form = event.target.closest('#vault-edit');
    if (form) form.dataset.dirty = 'true';
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
    return (!query || (cert ? normalizeCert(card.certNumber) === cert : searchable.includes(query)));
  });
  matches.sort((a, b) => compareVaultCards(a, b, sort));
  const list = document.getElementById('vault-list');
  const count = document.getElementById('vault-count');
  document.querySelector('.vault-layout').classList.toggle('is-empty', !matches.length);
  if (selectedId && matches.length && !matches.some(card => card.id === selectedId)) selectCard(matches[0].id);
  list.innerHTML = matches.length ? matches.map(listRow).join('') : '<div class="empty-state">No cards match those filters.</div>';
  document.querySelectorAll('.vault-row').forEach(row => row.setAttribute('aria-pressed', String(row.dataset.cardId === selectedId)));
  count.textContent = `${matches.length} ${matches.length === 1 ? 'card' : 'cards'} shown · ${sort.startsWith('price') ? 'Prices are grouped by currency; no conversion is applied.' : 'Prices stay private to your account and never appear on labels.'}`;
};

function compareVaultCards(a, b, sort) {
  const [field, direction] = sort.split('-');
  const sign = direction === 'desc' ? -1 : 1;
  if (field === 'name') return sign * a.name.localeCompare(b.name);
  const key = field === 'price' ? 'buyPrice' : 'receivedDate';
  const missing = card => card[key] == null || card[key] === '';
  if (missing(a) || missing(b)) return Number(missing(a)) - Number(missing(b));
  if (field === 'price') {
    const group = (a.buyCurrency || 'THB').localeCompare(b.buyCurrency || 'THB');
    return group || sign * (Number(a.buyPrice) - Number(b.buyPrice));
  }
  return sign * a.receivedDate.localeCompare(b.receivedDate);
}

function changeMode(mode) {
  if (vaultBusy) return;
  const form = document.getElementById('vault-edit');
  if (form?.dataset.dirty === 'true' && !confirm('Discard unsaved changes?')) return;
  selectCard(selectedId, mode);
  document.querySelector('#vault-edit input, #vault-edit select')?.focus();
}

window.__flipVault = () => {
  const isPrivate = !!document.querySelector('.vault-private, #vault-edit[data-mode="edit-private"]');
  changeMode(isPrivate ? 'item' : 'private');
};
window.__editVault = mode => changeMode(`edit-${mode}`);
window.__cancelVault = () => changeMode(document.getElementById('vault-edit')?.dataset.mode === 'edit-private' ? 'private' : 'item');

window.__saveDetail = async (event, id) => {
  event.preventDefault();
  if (!id) return;
  const button = document.querySelector('.detail-actions .btn-primary');
  button.disabled = true;
  vaultBusy = true;
  const privateMode = event.target.dataset.mode === 'edit-private';
  const keys = privateMode ? privateKeys.filter(key => key !== 'purchaseSource') : publicFields.map(([key]) => key);
  const patch = Object.fromEntries(keys.map(key => [key, event.target.elements[key].value]));
  if (privateMode) patch.purchaseSource = event.target.elements.sourceChoice.value === 'Other' ? event.target.elements.customSource.value : event.target.elements.sourceChoice.value;
  if (!privateMode) patch.certNumber = normalizeCert(patch.certNumber);
  try {
    await updateCard(id, patch);
    Object.assign(activeCards.find(card => card.id === id), patch);
    selectCard(id, privateMode ? 'private' : 'item');
    window.__filterVault();
  } catch (error) {
    document.getElementById('vault-edit-message').textContent = error.message || 'Details could not be saved.';
    button.disabled = false;
  } finally { vaultBusy = false; }
};

window.__deleteVault = id => {
  const dialog = document.querySelector('.vault-delete-dialog');
  const cancel = dialog.querySelector('[data-delete-cancel]');
  const confirmButton = dialog.querySelector('[data-delete-confirm]');
  if (vaultBusy) return;
  dialog.querySelector('[data-delete-message]').textContent = '';
  document.querySelector('.vault-menu').open = false;
  cancel.onclick = () => dialog.close();
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
    if (activeCards.length) { selectCard(activeCards[0].id); window.__filterVault(); }
    else location.reload();
  } catch (error) {
    dialog.querySelector('[data-delete-message]').textContent = error.message || 'Card could not be deleted.';
  } finally {
    buttons.forEach(button => { button.disabled = false; });
    vaultBusy = false;
  }
}
