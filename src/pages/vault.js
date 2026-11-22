import {deleteCard, updateCard} from '../store/cards.js';
import {listRow} from '../components/card-item.js';
import {vaultPhoto, initializeVaultPhoto} from '../components/vault-photo.js';
import {itemInformation} from './verify.js';
import {escapeHTML} from '../utils/format.js';
import {normalizeCert} from '../utils/cert.js';

const statuses = ['in-vault', 'for-sale', 'sold', 'grading'];
let activeCards = [];
let selectedId = '';
let vaultBusy = false;

function statusOptions(selected) {
  return statuses.map(status => {
    const label = status.replace('-', ' ');
    const active = status === selected ? ' selected' : '';
    return `<option value="${status}"${active}>${label}</option>`;
  }).join('');
}

const publicFields = [
  ['certNumber', 'Cert number', 8], ['name', 'Card name', 120], ['game', 'Brand / Title', 30], ['year', 'Year', 4],
  ['setName', 'Set name', 120], ['cardNumber', 'Card number', 30], ['rarity', 'Rarity', 80],
  ['gradeLabel', 'Condition', 60], ['sourceFinish', 'Finish', 30], ['sourceLanguage', 'Language code', 20]
];

function editFields(card) {
  return publicFields.map(([key, label, limit]) => `<label class="form-field"><span>${label}</span>
    <input class="form-control" name="${key}" maxlength="${limit}" value="${escapeHTML(card[key] || '')}" ${key === 'certNumber' ? 'inputmode="numeric" pattern="[0-9]{1,8}" required' : key === 'name' ? 'required' : ''}></label>`).join('');
}

export function vault(cards = []) {
  activeCards = cards;
  if (!cards.length) return '<main class="app-page vault-page"><section class="surface-card empty-state"><div class="page-eyebrow">YOUR COLLECTION</div><h1>My Vault</h1><p>Your private vault is ready for its first card.</p><a class="btn btn-primary" href="/register">Add a card</a></section></main>';
  const params = new URLSearchParams(location.search);
  const focus = cards.find(card => card.id === params.get('id')) || cards[0];
  selectedId = focus.id;
  const rows = cards.length ? cards.map(listRow).join('') : '<div class="empty-state">No cards in your vault yet.</div>';

  return `
    <main class="app-page vault-page">
      <header class="page-heading vault-heading">
        <div class="page-eyebrow">YOUR COLLECTION</div>
        <h1>My Vault</h1>
        <p id="vault-count" class="page-description">${cards.length} ${cards.length === 1 ? 'card' : 'cards'} · Prices stay private to your account and never appear on labels.</p>
      </header>
      <div class="vault-toolbar">
        <label class="vault-query"><span class="sr-only">Search your cards</span><input id="vault-q" class="form-control" placeholder="Search name, set or Cert number"></label>
        <label class="vault-status"><span class="sr-only">Filter by status</span><select id="vault-status" class="form-control"><option value="">All status</option>${statusOptions('')}</select></label>
        <button class="btn btn-primary" type="button" onclick="window.__filterVault()">Filter</button>
      </div>
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
        <div class="vault-delete-actions"><button class="btn btn-ghost" type="button" data-delete-cancel autofocus>Cancel</button><button class="btn btn-primary" type="button" data-delete-confirm>Delete card</button></div>
      </dialog>
    </main>`;
}

const flipIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-5V2M4 17h5v5M20 7a8 8 0 0 0-14-2M4 17a8 8 0 0 0 14 2"/></svg>';
const privateFields = [['buyPrice', 'Buy price (THB)'], ['sellPrice', 'Sell price (THB)'],
  ['status', 'Status'], ['boughtFrom', 'Bought from'], ['artist', 'Artist / Illustrator'], ['notes', 'Notes']];

function privateInformation(card) {
  return `<section class="cert-information vault-private"><h2>Private vault details</h2><dl>${privateFields.map(([key, label]) =>
    `<div><dt>${label}</dt><dd>${escapeHTML(card[key] === 0 ? '0' : card[key] || '-')}</dd></div>`).join('')}</dl></section>`;
}

function privateInputs(card) {
  return `<label class="form-field"><span>Buy price (THB)</span><input class="form-control" name="buyPrice" inputmode="decimal" value="${escapeHTML(card.buyPrice ?? '')}"></label>
    <label class="form-field"><span>Sell price (THB)</span><input class="form-control" name="sellPrice" inputmode="decimal" value="${escapeHTML(card.sellPrice ?? '')}"></label>
    <label class="form-field"><span>Status</span><select class="form-control" name="status"><option value="">Select status</option>${statusOptions(card.status || '')}</select></label>
    <label class="form-field"><span>Bought from</span><input class="form-control" name="boughtFrom" value="${escapeHTML(card.boughtFrom || '')}"></label>
    <label class="form-field"><span>Artist / Illustrator</span><input class="form-control" name="artist" maxlength="120" value="${escapeHTML(card.artist || '')}"></label>
    <label class="form-field"><span>Notes</span><textarea class="form-control" name="notes" maxlength="2000" rows="3">${escapeHTML(card.notes || '')}</textarea></label>`;
}

function detailMarkup(card, mode = 'item') {
  const editing = mode.startsWith('edit-');
  const privateMode = mode === 'private' || mode === 'edit-private';
  return `<div class="vault-detail-controls"><button class="vault-edit-button vault-detail-flip" type="button" onclick="window.__flipVault()" aria-label="${privateMode ? 'Show item information' : 'Show private vault details'}" title="Switch details">${flipIcon}</button>
    <details class="vault-menu"><summary class="vault-edit-button" aria-label="Edit options" title="Edit options">⋯</summary><div class="vault-menu-options">
    <button type="button" onclick="window.__editVault('card')">Edit card</button><button type="button" onclick="window.__editVault('private')">Edit private</button></div></details></div>
    ${editing ? `<form id="vault-edit" class="vault-edit" data-mode="${mode}" onsubmit="window.__saveDetail(event, '${escapeHTML(card.id)}')">
      <h2>${privateMode ? 'Private vault details' : 'Edit card details'}</h2>
      <p class="detail-note">${privateMode ? 'Prices and vault details are private.' : 'These card details appear on the public certificate.'}</p>
      ${privateMode ? privateInputs(card) : `<div class="vault-edit-grid">${editFields(card)}</div>`}
      <div class="detail-actions"><button class="btn btn-primary" type="submit">Save details</button><button class="btn btn-ghost" type="button" onclick="window.__cancelVault()">Cancel</button><button class="btn btn-ghost vault-delete" type="button" onclick="window.__deleteVault('${escapeHTML(card.id)}')">Delete card</button></div>
      <p class="detail-note" id="vault-edit-message" role="status"></p></form>` : (privateMode ? privateInformation(card) : itemInformation(card))}`;
}

function selectCard(id, mode = 'item') {
  const card = activeCards.find(item => item.id === id);
  if (!card) return;
  selectedId = id;
  document.querySelector('.vault-detail').innerHTML = detailMarkup(card, mode);
  document.querySelector('.vault-photo-panel').innerHTML = vaultPhoto(card);
  initializeVaultPhoto(document.querySelector('.vault-photo-panel'));
  document.querySelectorAll('.vault-row').forEach(row => {
    row.setAttribute('aria-pressed', String(row.dataset.cardId === id));
  });
}

window.__selectVault = id => {
  if (vaultBusy || selectedId === id) return;
  const form = document.getElementById('vault-edit');
  if (form?.dataset.dirty === 'true' && !confirm('Discard unsaved changes?')) return;
  selectCard(id);
};

export function initializeVault() {
  if (location.search) history.replaceState(history.state, '', '/vault');
  if (selectedId) selectCard(selectedId);
  document.querySelector('.vault-detail')?.addEventListener('input', event => {
    const form = event.target.closest('#vault-edit');
    if (form) form.dataset.dirty = 'true';
  });
}

window.__filterVault = () => {
  const query = (document.getElementById('vault-q').value || '').trim().toLowerCase();
  const status = document.getElementById('vault-status').value;
  const matches = activeCards.filter(card => {
    const searchable = [card.name, card.setName, card.certNumber, card.cardNumber].join(' ').toLowerCase();
    return (!query || searchable.includes(query)) && (!status || card.status === status);
  });
  const list = document.getElementById('vault-list');
  const count = document.getElementById('vault-count');
  list.innerHTML = matches.length ? matches.map(listRow).join('') : '<div class="empty-state">No cards match those filters.</div>';
  document.querySelectorAll('.vault-row').forEach(row => row.setAttribute('aria-pressed', String(row.dataset.cardId === selectedId)));
  count.textContent = `${matches.length} ${matches.length === 1 ? 'card' : 'cards'} shown · Prices stay private to your account and never appear on labels.`;
};

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
  const keys = privateMode ? privateFields.map(([key]) => key) : publicFields.map(([key]) => key);
  const patch = Object.fromEntries(keys.map(key => [key, event.target.elements[key].value]));
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
  cancel.onclick = () => dialog.close();
  confirmButton.onclick = () => { dialog.close(); removeVaultCard(id); };
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
  dialog.showModal();
};

async function removeVaultCard(id) {
  vaultBusy = true;
  const buttons = document.querySelectorAll('#vault-edit button');
  buttons.forEach(button => { button.disabled = true; });
  try {
    await deleteCard(id);
    activeCards = activeCards.filter(card => card.id !== id);
    if (activeCards.length) { selectCard(activeCards[0].id); window.__filterVault(); }
    else location.reload();
  } catch (error) {
    document.getElementById('vault-edit-message').textContent = error.message || 'Card could not be deleted.';
    buttons.forEach(button => { button.disabled = false; });
  } finally { vaultBusy = false; }
}
