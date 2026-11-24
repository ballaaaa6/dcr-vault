import {collectionsRequest} from '../store/collections.js';
import {escapeHTML as esc} from '../utils/format.js';
import {heartCheckbox} from '../components/heart-checkbox.js';
import {vaultImage} from '../components/card-item.js';
import {compareVaultCards, vaultSortSelect} from '../utils/vault-sort.js';
import {tooltip} from '../components/tooltip.js';
import {showToast} from '../components/toast.js';
import {listView, detailView, collectionItems} from './collections-view.js';

let groups = [], cards = [], selectedId = '', preview = false;
const content = () => document.getElementById('collections-content');
const current = () => groups.find(group => group.id === selectedId);
const dialog = () => document.getElementById('collections-dialog');
function collectionPath(group) { return `/showcase/${encodeURIComponent(group.name)}`; }
function navigate(group) { history.pushState({}, '', group ? collectionPath(group) : '/showcase'); }
function draw() { if (content()) content().innerHTML = current() ? detailView(current(), cards, preview) : listView(groups, cards); }
async function refresh() { groups = (await collectionsRequest()).collections; draw(); }
function openDialog(title, body) {
  document.getElementById('collections-dialog-content').innerHTML = `<header><h2>${title}</h2></header>${body}`;
  if (!dialog().open) dialog().showModal();
}
function editDialog(group) {
  openDialog(group ? 'Edit showcase' : 'Create showcase', `<form id="collection-form" class="collections-form"><div class="form-field"><label for="collection-name">Name</label>${tooltip({id: 'collection-name-help', label: 'About showcase name', message: 'Use English letters and numbers only, without spaces.'})}<input id="collection-name" class="form-control" name="name" autofocus maxlength="120" required value="${esc(group?.name || '')}"></div><div class="form-field"><label for="collection-description">Description</label>${tooltip({id: 'collection-description-help', label: 'About showcase description', message: 'Optionally describe this showcase. The description is visible to anyone with its share link.'})}<textarea id="collection-description" class="form-control" name="description" maxlength="500">${esc(group?.description || '')}</textarea></div><div class="collections-actions collections-form-actions">${group ? '<button class="btn btn-ghost" type="button" data-action="delete">Delete showcase</button>' : ''}<button class="btn btn-primary" type="submit">Save</button></div></form>`);
}
function addDialog() {
  const group = current();
  const sorted = [...cards].sort((a, b) => compareVaultCards(a, b, 'date-desc'));
  const rows = sorted.map(card => `<label>${heartCheckbox(`name="card" value="${esc(card.id)}" ${group.cardIds.includes(card.id) ? 'checked' : ''}`)}<span><strong>${esc(card.name)}</strong><small>Cert ${esc(card.certNumber || '')}</small></span><span class="label-card-image">${vaultImage({...card, referenceImage: card.frontImage || card.referenceImage, frontImage: card.referenceImage}, 'label-image-empty', 'No photo')}</span></label>`).join('');
  openDialog('Choose from Vault', `<form id="collection-cards-form"><p class="muted label-dialog-description">Select the cards you want in this showcase.</p><div class="label-vault-toolbar"><label class="label-select-all">${heartCheckbox(`data-collection-select-all ${cards.length ? '' : 'disabled'}`)} Select all</label>${vaultSortSelect('collection-vault-sort')}</div><div class="label-vault-list">${rows || '<p>No cards in your vault.</p>'}</div><div class="label-controls label-vault-actions"><button class="btn btn-primary" type="submit">Save selection</button></div></form>`);
  updatePickerSelection();
}
function updatePickerSelection() {
  const all = dialog().querySelector('[data-collection-select-all]');
  if (!all) return;
  const boxes = [...dialog().querySelectorAll('.label-vault-list input')];
  const count = boxes.filter(box => box.checked).length;
  all.checked = boxes.length > 0 && count === boxes.length;
  all.indeterminate = count > 0 && count < boxes.length;
}
function changePicker(event) {
  const list = dialog().querySelector('.label-vault-list');
  if (!list) return;
  if (event.target.id === 'collection-vault-sort') {
    const byId = new Map(cards.map(card => [card.id, card]));
    [...list.querySelectorAll('label')].sort((a, b) => compareVaultCards(byId.get(a.querySelector('input').value), byId.get(b.querySelector('input').value), event.target.value)).forEach(row => list.append(row));
  }
  if (event.target.matches('[data-collection-select-all]')) list.querySelectorAll('input').forEach(box => { box.checked = event.target.checked; });
  if (event.target.matches('[data-collection-select-all], .label-vault-list input')) updatePickerSelection();
}
function manageCardsDialog() {
  const group = current();
  const items = group.cardIds.map((id, index) => {
    const card = cards.find(item => item.id === id);
    if (!card) return '';
    return `<div class="collections-manage-row"><strong>${esc(card.name)}</strong><div><button type="button" class="btn btn-ghost" data-move="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="Move ${esc(card.name)} earlier">↑</button><button type="button" class="btn btn-ghost" data-move="${index}" data-direction="1" ${index === group.cardIds.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(card.name)} later">↓</button><button type="button" class="btn btn-ghost" data-remove="${esc(id)}">Remove</button></div></div>`;
  }).join('');
  openDialog('Manage cards', `<div class="collections-manage-list button-safe-scroll">${items || '<p>No cards in this showcase yet.</p>'}</div>`);
}
function shareDialog() {
  const group = current(), enabled = Boolean(group.shareEnabled);
  const link = group.shareToken ? `${location.origin}/showcase/${encodeURIComponent(group.name.replace(/[^a-zA-Z0-9]/g, '') || 'collection')}/${group.shareToken}` : '';
  const status = enabled ? 'Public' : 'Private';
  openDialog('Share showcase', `<div class="collections-share"><p>Anyone with the link can view and forward selected cards and their public details. Prices, notes and storage locations stay private. Photos and certificate details may already be public.</p><div class="search-bar collections-share-link ${enabled ? '' : 'is-disabled'}"><input id="collection-share-link" aria-label="Share link" readonly value="${esc(link)}" placeholder="Turn on sharing to create a link"><button type="button" data-action="copy" ${enabled ? '' : 'disabled'}>Copy</button></div></div>`);
  dialog().querySelector('header').insertAdjacentHTML('beforeend', `<label class="relative inline-flex items-center cursor-pointer collections-share-toggle">
  <input type="checkbox" value="" class="sr-only peer" role="switch" aria-label="Link copying: ${status}" aria-describedby="share-status" data-share-switch ${enabled ? '' : 'checked'}>
  <div class="group peer ring-0 bg-rose-400  rounded-full outline-none duration-300 after:duration-300 w-24 h-12  shadow-md peer-checked:bg-emerald-500  peer-focus:outline-none  after:content-[''] after:rounded-full after:absolute after:bg-gray-50 after:outline-none after:h-10 after:w-10 after:top-1 after:left-1 after:flex after:justify-center after:items-center peer-checked:after:translate-x-12 peer-hover:after:scale-95">
    <svg class="absolute  top-1 left-12 stroke-gray-900 w-10 h-10" height="100" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 100" width="100" x="0" xmlns="http://www.w3.org/2000/svg" y="0">
 <path class="svg-fill-primary" d="M50,18A19.9,19.9,0,0,0,30,38v8a8,8,0,0,0-8,8V74a8,8,0,0,0,8,8H70a8,8,0,0,0,8-8V54a8,8,0,0,0-8-8H38V38a12,12,0,0,1,23.6-3,4,4,0,1,0,7.8-2A20.1,20.1,0,0,0,50,18Z">
 </path>
</svg>
    <svg class="absolute top-1 left-1 stroke-gray-900  w-10 h-10" height="100" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 100" width="100" x="0" xmlns="http://www.w3.org/2000/svg" y="0">
 <path d="M30,46V38a20,20,0,0,1,40,0v8a8,8,0,0,1,8,8V74a8,8,0,0,1-8,8H30a8,8,0,0,1-8-8V54A8,8,0,0,1,30,46Zm32-8v8H38V38a12,12,0,0,1,24,0Z" fill-rule="evenodd">
 </path>
</svg>
  </div><span id="share-status" class="collections-share-status" role="tooltip">${status}</span>
</label>`);
}
async function updateMembership(next) {
  const group = current();
  await collectionsRequest('PUT', {id: group.id, add: next.filter(id => !group.cardIds.includes(id)), remove: group.cardIds.filter(id => !next.includes(id))});
  await refresh();
}
async function saveForm(form) {
  const data = new FormData(form), name = String(data.get('name')).trim(), description = String(data.get('description')).trim();
  if (!name) throw new Error('Enter a showcase name.');
  let id = selectedId;
  if (!id) id = (await collectionsRequest('POST', {name})).collection.id;
  await collectionsRequest('PATCH', {id, name, description});
  selectedId = id; dialog().close(); await refresh(); history.replaceState({}, '', collectionPath(current())); showToast('Showcase saved.', 'success');
}
async function handleAction(action) {
  if (action === 'create') return editDialog();
  if (action === 'edit') return editDialog(current());
  if (action === 'add') return addDialog();
  if (action === 'manage-cards') return manageCardsDialog();
  if (action === 'share') return shareDialog();
  if (action === 'back') { selectedId = ''; preview = false; navigate(); return draw(); }
  if (action === 'preview') { preview = !preview; return draw(); }
  if (action === 'copy') { await navigator.clipboard.writeText(document.getElementById('collection-share-link').value); return showToast('Link copied.', 'success'); }
  if (action === 'enable-share' || action === 'disable-share') { await collectionsRequest('PATCH', {id: selectedId, share: action === 'enable-share'}); await refresh(); shareDialog(); dialog().querySelector('[data-share-switch]').focus(); return; }
  if (action === 'delete') return openDeleteConfirmation();
  if (action === 'confirm-delete') { await collectionsRequest('DELETE', {id: selectedId}); selectedId = ''; navigate(); dialog().close(); await refresh(); showToast('Showcase deleted.', 'success'); }
}
function openDeleteConfirmation() {
  openDialog('Delete showcase?', '<p>Loading…</p>');
  document.getElementById('collections-dialog-content').innerHTML = `<div class="collections-delete-confirmation"><h2>Delete showcase?</h2><p class="two-choice-description">Cards will remain in Vault. Any share link will stop working.</p><div class="two-choice-actions collections-actions"><button class="btn btn-ghost" data-action="edit">Cancel</button><button class="btn btn-primary" data-action="confirm-delete">Delete</button></div></div>`;
}
async function handleClick(event) {
  const target = event.target.closest('button'); if (!target) return;
  if (target.hasAttribute('data-close')) return dialog().close();
  if (target.dataset.groupAction) { selectedId = target.dataset.groupId; navigate(current()); draw(); return handleAction(target.dataset.groupAction); }
  if (target.dataset.open) { selectedId = target.dataset.open; navigate(current()); return draw(); }
  if (target.dataset.action) { target.closest('details')?.removeAttribute('open'); return handleAction(target.dataset.action); }
  if (target.dataset.remove) { await updateMembership(current().cardIds.filter(id => id !== target.dataset.remove)); return manageCardsDialog(); }
  if (target.dataset.move !== undefined) {
    const order = [...current().cardIds], from = Number(target.dataset.move), to = from + Number(target.dataset.direction);
    [order[from], order[to]] = [order[to], order[from]];
    await collectionsRequest('PATCH', {id: selectedId, cardOrder: order}); await refresh(); manageCardsDialog();
  }
}
export function initializeCollections(initialGroups, initialCards, ownerCollection) {
  groups = initialGroups; cards = initialCards;
  let name = ''; try { name = decodeURIComponent(ownerCollection || ''); } catch {}
  selectedId = groups.find(group => group.name.toLowerCase() === name.toLowerCase())?.id || ''; preview = false; draw();
  const page = document.querySelector('.collections-page');
  page.addEventListener('click', event => { handleClick(event).catch(error => showToast(error.message, 'error')); });
  const filterList = () => {
    const query = page.querySelector('#collections-search').value.trim().toLocaleLowerCase();
    const sort = page.querySelector('#collections-sort').value;
    const filtered = groups.filter(group => group.name.toLocaleLowerCase().includes(query));
    filtered.sort((a, b) => sort === 'count' ? b.cardIds.length - a.cardIds.length || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
    page.querySelector('#collections-list').innerHTML = collectionItems(filtered, cards);
  };
  page.addEventListener('input', event => {
    if (event.target.id === 'collections-search') filterList();
    if (event.target.id === 'collection-name') event.target.value = event.target.value.replace(/[^a-zA-Z0-9]/g, '');
  });
  page.addEventListener('change', event => { if (event.target.matches('[data-share-switch]')) handleAction(event.target.checked ? 'disable-share' : 'enable-share').catch(error => { shareDialog(); showToast(error.message, 'error'); }); if (event.target.id === 'collections-sort') filterList(); changePicker(event); });
  page.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    const operation = form.id === 'collection-form' ? saveForm(form) : updateMembership(new FormData(form).getAll('card')).then(() => dialog().close());
    operation.catch(error => showToast(error.message, 'error'));
  });
}
