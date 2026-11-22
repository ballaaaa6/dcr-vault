import {deleteCard, updateCard} from '../store/cards.js';
import {listRow, vaultImage} from '../components/card-item.js';
import {itemInformation} from './verify.js';
import {escapeHTML} from '../utils/format.js';

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
  ['name', 'Card name', 120], ['game', 'Brand / Title', 30], ['year', 'Year', 4],
  ['setName', 'Set name', 120], ['cardNumber', 'Card number', 30], ['rarity', 'Rarity', 80],
  ['gradeLabel', 'Condition', 60], ['sourceFinish', 'Finish', 30], ['sourceLanguage', 'Language code', 20]
];

function editFields(card) {
  return publicFields.map(([key, label, limit]) => `<label class="form-field"><span>${label}</span>
    <input class="form-control" name="${key}" maxlength="${limit}" value="${escapeHTML(card[key] || '')}" ${key === 'name' ? 'required' : ''}></label>`).join('');
}

export function vault(cards = []) {
  activeCards = cards;
  if (!cards.length) return '<main class="app-page"><section class="surface-card empty-state"><div class="page-eyebrow">YOUR COLLECTION</div><h1>My Vault</h1><p>Your private vault is ready for its first card.</p><a class="btn btn-primary" href="/register">Add a card</a></section></main>';
  const params = new URLSearchParams(location.search);
  const focus = cards.find(card => card.id === params.get('id')) || cards[0];
  selectedId = focus.id;
  const rows = cards.length ? cards.map(listRow).join('') : '<div class="empty-state">No cards in your vault yet.</div>';

  return `
    <main class="app-page">
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
        <aside class="surface-card vault-detail" aria-label="Selected card details">${detailMarkup(focus)}</aside>
      </div>
    </main>`;
}

function detailMarkup(focus) {
  const name = escapeHTML(focus?.name || 'No card selected');
  const summary = focus ? [focus.setName, focus.year, focus.cardNumber].map(escapeHTML).filter(Boolean).join(' • ') : '';
  const grade = escapeHTML(focus?.gradeLabel || '');
  const cert = escapeHTML(focus?.certNumber || '');
  const frontPhoto = vaultImage(focus, 'vault-detail-photo-empty', 'No front photo available', 'vault-detail-image');

  return `
<div class="vault-detail-photo">${frontPhoto}</div>
          <div class="vault-detail-header"><div class="detail-heading"><div class="page-eyebrow">CARD DETAILS</div><h2>${name}</h2><p class="muted">${summary}</p></div><button class="vault-edit-button" type="button" onclick="window.__editVault()" aria-label="Edit card details" title="Edit card details">⋯</button></div>
          <div class="detail-identity"><span class="badge">${grade}</span><span class="muted">Cert: ${cert}</span></div>
          ${itemInformation(focus)}
          <a class="btn btn-ghost" href="/label?cert=${encodeURIComponent(focus?.certNumber || '')}">Print label</a>
          <form id="vault-edit" class="vault-edit" hidden onsubmit="window.__saveDetail(event, '${escapeHTML(focus?.id || '')}')">
            <h3>Edit card details</h3>
            <p class="detail-note">These card details appear on the public certificate.</p>
            <div class="vault-edit-grid">${editFields(focus)}</div>
          <h3>Private vault details</h3>
          <label class="form-field"><span>Buy price (THB)</span><input class="form-control" id="d-buy" inputmode="decimal" value="${escapeHTML(focus?.buyPrice ?? '')}"></label>
          <label class="form-field"><span>Sell price (THB)</span><input class="form-control" id="d-sell" inputmode="decimal" value="${escapeHTML(focus?.sellPrice ?? '')}"></label>
          <label class="form-field"><span>Status</span><select class="form-control" id="d-status"><option value="">Select status</option>${statusOptions(focus?.status || '')}</select></label>
          <label class="form-field"><span>Bought from</span><input class="form-control" id="d-from" value="${escapeHTML(focus?.boughtFrom || '')}"></label>
          <label class="form-field"><span>Artist / Illustrator</span><input class="form-control" id="d-artist" maxlength="120" value="${escapeHTML(focus?.artist || '')}"></label>
          <label class="form-field"><span>Notes</span><textarea class="form-control" id="d-notes" maxlength="2000" rows="3">${escapeHTML(focus?.notes || '')}</textarea></label>
          <div class="detail-actions">
            <button class="btn btn-primary" type="submit">Save details</button><button class="btn btn-ghost" type="button" onclick="window.__editVault(false)">Cancel</button><button class="btn btn-ghost vault-delete" type="button" onclick="window.__deleteVault('${escapeHTML(focus?.id || '')}')">Delete card</button>
          </div>
          <p class="detail-note" id="vault-edit-message" role="status">Prices and vault details are private.</p>
          </form>`;
}

function selectCard(id) {
  const card = activeCards.find(item => item.id === id);
  if (!card) return;
  selectedId = id;
  document.querySelector('.vault-detail').innerHTML = detailMarkup(card);
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

window.__editVault = (open = true) => {
  if (vaultBusy) return;
  if (!open) { selectCard(selectedId); return; }
  document.getElementById('vault-edit').hidden = false;
  document.querySelector('#vault-edit input').focus();
};

window.__saveDetail = async (event, id) => {
  event.preventDefault();
  if (!id) return;
  const button = document.querySelector('.detail-actions .btn-primary');
  button.disabled = true;
  vaultBusy = true;
  const patch = {
      ...Object.fromEntries(publicFields.map(([key]) => [key, event.target.elements[key].value])),
      buyPrice: document.getElementById('d-buy').value,
      sellPrice: document.getElementById('d-sell').value,
      status: document.getElementById('d-status').value,
      boughtFrom: document.getElementById('d-from').value,
      artist: document.getElementById('d-artist').value,
      notes: document.getElementById('d-notes').value
    };
  try {
    await updateCard(id, patch);
    Object.assign(activeCards.find(card => card.id === id), patch);
    selectCard(id);
    window.__filterVault();
  } catch (error) {
    document.getElementById('vault-edit-message').textContent = error.message || 'Details could not be saved.';
    button.disabled = false;
  } finally { vaultBusy = false; }
};

window.__deleteVault = async id => {
  if (!confirm('Delete this card and its photos? Its certificate number will become available for another card.')) return;
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
};
