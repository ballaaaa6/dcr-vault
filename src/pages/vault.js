import {updateCard} from '../store/cards.js';
import {listRow, vaultImage} from '../components/card-item.js';
import {escapeHTML} from '../utils/format.js';

const statuses = ['in-vault', 'for-sale', 'sold', 'grading'];
let activeCards = [];

function statusOptions(selected) {
  return statuses.map(status => {
    const label = status.replace('-', ' ');
    const active = status === selected ? ' selected' : '';
    return `<option value="${status}"${active}>${label}</option>`;
  }).join('');
}

export function vault(cards = []) {
  activeCards = cards;
  if (!cards.length) return '<main class="app-page"><section class="surface-card empty-state"><div class="page-eyebrow">YOUR COLLECTION</div><h1>My Vault</h1><p>Your private vault is ready for its first card.</p><a class="btn btn-primary" href="/register">Add a card</a></section></main>';
  const params = new URLSearchParams(location.search);
  const focus = cards.find(card => card.id === params.get('id')) || cards[0];
  const rows = cards.length ? cards.map(listRow).join('') : '<div class="empty-state">No cards in your vault yet.</div>';
  const name = escapeHTML(focus?.name || 'No card selected');
  const summary = focus ? [focus.setName, focus.year, focus.cardNumber].map(escapeHTML).filter(Boolean).join(' • ') : '';
  const grade = escapeHTML(focus?.gradeLabel || '');
  const cert = escapeHTML(focus?.certNumber || '');
  const frontPhoto = vaultImage(focus, 'vault-detail-photo-empty', 'No front photo available', 'vault-detail-image');

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
        <aside class="surface-card vault-detail" aria-label="Selected card details">
          <div class="vault-detail-photo">${frontPhoto}</div>
          <div class="detail-heading"><div class="page-eyebrow">CARD DETAILS</div><h2>${name}</h2><p class="muted">${summary}</p></div>
          <div class="detail-identity"><span class="badge">${grade}</span><span class="muted">Cert: ${cert}</span></div>
          <label class="form-field"><span>Buy price (THB)</span><input class="form-control" id="d-buy" inputmode="decimal" value="${escapeHTML(focus?.buyPrice ?? '')}"></label>
          <label class="form-field"><span>Sell price (THB)</span><input class="form-control" id="d-sell" inputmode="decimal" value="${escapeHTML(focus?.sellPrice ?? '')}"></label>
          <label class="form-field"><span>Status</span><select class="form-control" id="d-status"><option value="">Select status</option>${statusOptions(focus?.status || '')}</select></label>
          <label class="form-field"><span>Bought from</span><input class="form-control" id="d-from" value="${escapeHTML(focus?.boughtFrom || '')}"></label>
          <div class="detail-actions">
            <button class="btn btn-primary" type="button" onclick="window.__saveDetail('${escapeHTML(focus?.id || '')}')">Save details</button>
            <a class="btn btn-ghost" href="/label?cert=${encodeURIComponent(focus?.certNumber || '')}">Print label</a>
          </div>
          <p class="detail-note">Prices are private to your account and stay off printed labels.</p>
        </aside>
      </div>
    </main>`;
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
  count.textContent = `${matches.length} ${matches.length === 1 ? 'card' : 'cards'} shown · Prices stay private to your account and never appear on labels.`;
};

window.__saveDetail = async id => {
  if (!id) return;
  const button = document.querySelector('.detail-actions .btn-primary');
  button.disabled = true;
  try {
    await updateCard(id, {
      buyPrice: document.getElementById('d-buy').value,
      sellPrice: document.getElementById('d-sell').value,
      status: document.getElementById('d-status').value,
      boughtFrom: document.getElementById('d-from').value
    });
    location.href = `/vault?id=${encodeURIComponent(id)}`;
  } catch (error) {
    document.querySelector('.detail-note').textContent = error.message || 'Details could not be saved.';
    button.disabled = false;
  }
};
