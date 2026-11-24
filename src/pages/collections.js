import {collectionsRequest} from '../store/collections.js';
import {escapeHTML as esc} from '../utils/format.js';
import {heartCheckbox} from '../components/heart-checkbox.js';
import {showToast} from '../components/toast.js';
import {listView, detailView, collectionItems} from './collections-view.js';

let groups = [], cards = [], selectedId = '', preview = false;
const content = () => document.getElementById('collections-content');
const current = () => groups.find(group => group.id === selectedId);
const dialog = () => document.getElementById('collections-dialog');
function draw() { if (content()) content().innerHTML = current() ? detailView(current(), cards, preview) : listView(groups, cards); }
async function refresh() { groups = (await collectionsRequest()).collections; draw(); }
function openDialog(title, body) {
  document.getElementById('collections-dialog-content').innerHTML = `<header><h2>${title}</h2><button class="dialog-close" type="button" data-close aria-label="Close">×</button></header>${body}`;
  if (!dialog().open) dialog().showModal();
}
function editDialog(group) {
  openDialog(group ? 'Edit collection' : 'Create collection', `<form id="collection-form" class="collections-form"><label class="form-field">Name<input class="form-control" name="name" maxlength="120" required value="${esc(group?.name || '')}"></label><label class="form-field">Description<textarea class="form-control" name="description" maxlength="500">${esc(group?.description || '')}</textarea></label><div class="collections-actions"><button class="btn btn-primary" type="submit">Save</button>${group ? '<button class="btn btn-ghost" type="button" data-action="delete">Delete collection</button>' : ''}</div></form>`);
}
function addDialog() {
  const group = current();
  openDialog('Choose cards from My Vault', `<form id="collection-cards-form"><p class="page-description">Select the cards you want in this collection.</p><div class="collections-picker button-safe-scroll">${cards.map(card => `<label class="list-row">${heartCheckbox(`name="card" value="${esc(card.id)}" ${group.cardIds.includes(card.id) ? 'checked' : ''}`)}<span><strong>${esc(card.name)}</strong><small>Cert ${esc(card.certNumber)}</small></span></label>`).join('') || '<p>No cards in My Vault yet.</p>'}</div><button class="btn btn-primary" type="submit">Save selection</button></form>`);
}
function shareDialog() {
  const group = current();
  const link = group.shareToken ? `${location.origin}/shared-collection/${group.shareToken}` : '';
  openDialog('Share collection', `<p>Anyone with the link can view and forward this collection. Only the selected cards and their public details are shown; prices, notes and storage locations stay private.</p><p>Card photos and certificate details may already be public. Turning off this link does not make them private.</p>${link ? `<label class="form-field">Share link<input class="form-control" id="collection-share-link" readonly value="${esc(link)}"></label><div class="collections-actions"><button class="btn btn-primary" data-action="copy">Copy link</button><button class="btn btn-ghost" data-action="disable-share">Turn off sharing</button></div>` : '<button class="btn btn-primary" data-action="enable-share">Enable link sharing</button>'}`);
}
async function updateMembership(next) {
  const group = current();
  await collectionsRequest('PUT', {id: group.id, add: next.filter(id => !group.cardIds.includes(id)), remove: group.cardIds.filter(id => !next.includes(id))});
  await refresh();
}
async function saveForm(form) {
  const data = new FormData(form), name = String(data.get('name')).trim(), description = String(data.get('description')).trim();
  if (!name) throw new Error('Enter a collection name.');
  let id = selectedId;
  if (!id) id = (await collectionsRequest('POST', {name})).collection.id;
  await collectionsRequest('PATCH', {id, name, description});
  selectedId = id; dialog().close(); await refresh(); showToast('Collection saved.', 'success');
}
async function handleAction(action) {
  if (action === 'create') return editDialog();
  if (action === 'edit') return editDialog(current());
  if (action === 'add') return addDialog();
  if (action === 'share') return shareDialog();
  if (action === 'back') { selectedId = ''; preview = false; return draw(); }
  if (action === 'preview') { preview = !preview; return draw(); }
  if (action === 'copy') { await navigator.clipboard.writeText(document.getElementById('collection-share-link').value); return showToast('Link copied.', 'success'); }
  if (action === 'enable-share' || action === 'disable-share') { await collectionsRequest('PATCH', {id: selectedId, share: action === 'enable-share'}); dialog().close(); await refresh(); shareDialog(); return; }
  if (action === 'delete') return openDeleteConfirmation();
  if (action === 'confirm-delete') { await collectionsRequest('DELETE', {id: selectedId}); selectedId = ''; dialog().close(); await refresh(); showToast('Collection deleted.', 'success'); }
}
function openDeleteConfirmation() {
  document.getElementById('collections-dialog-content').innerHTML = `<div class="two-choice-dialog"><h2>Delete collection?</h2><p class="two-choice-description">Cards will remain in My Vault. Any share link will stop working.</p><div class="two-choice-actions collections-actions"><button class="btn btn-ghost" data-action="edit">Cancel</button><button class="btn btn-primary" data-action="confirm-delete">Delete</button></div></div>`;
}
async function handleClick(event) {
  const target = event.target.closest('button'); if (!target) return;
  if (target.hasAttribute('data-close')) return dialog().close();
  if (target.dataset.groupAction) { selectedId = target.dataset.groupId; draw(); return handleAction(target.dataset.groupAction); }
  if (target.dataset.open) { selectedId = target.dataset.open; return draw(); }
  if (target.dataset.action) return handleAction(target.dataset.action);
  if (target.dataset.remove) return updateMembership(current().cardIds.filter(id => id !== target.dataset.remove));
  if (target.dataset.move !== undefined) {
    const order = [...current().cardIds], from = Number(target.dataset.move), to = from + Number(target.dataset.direction);
    [order[from], order[to]] = [order[to], order[from]];
    await collectionsRequest('PATCH', {id: selectedId, cardOrder: order}); await refresh();
  }
}
export function initializeCollections(initialGroups, initialCards) {
  groups = initialGroups; cards = initialCards; selectedId = ''; preview = false; draw();
  const page = document.querySelector('.collections-page');
  page.addEventListener('click', event => { handleClick(event).catch(error => showToast(error.message, 'error')); });
  const filterList = () => {
    const query = page.querySelector('#collections-search').value.trim().toLocaleLowerCase();
    const sort = page.querySelector('#collections-sort').value;
    const filtered = groups.filter(group => group.name.toLocaleLowerCase().includes(query));
    filtered.sort((a, b) => sort === 'count' ? b.cardIds.length - a.cardIds.length || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
    page.querySelector('#collections-list').innerHTML = collectionItems(filtered, cards);
  };
  page.addEventListener('input', event => { if (event.target.id === 'collections-search') filterList(); });
  page.addEventListener('change', event => { if (event.target.id === 'collections-sort') filterList(); });
  page.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    const operation = form.id === 'collection-form' ? saveForm(form) : updateMembership(new FormData(form).getAll('card')).then(() => dialog().close());
    operation.catch(error => showToast(error.message, 'error'));
  });
}
