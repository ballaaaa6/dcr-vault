import {escapeHTML as esc} from '../utils/format.js';
import {manageLocationCards} from './vault-location-cards.js';
import {locationsRequest} from '../store/locations.js';
import {initializeLocationSorting} from './vault-location-sorting.js';
import {collectionsRequest} from '../store/collections.js';

let locations = [];
let collections = [];
let isCollection = false;
const items = () => isCollection ? collections : locations;
const request = (...args) => (isCollection ? collectionsRequest : locationsRequest)(...args);
const kind = () => isCollection ? 'collection' : 'location';
export function setCollections(value) { collections = value; }
export function getCollections() { return collections; }
let refresh = () => {};
let busy = false;
let getCards = () => [];
let openerHandler = null;
export function setLocations(items) { locations = items; }
export function getLocations() { return locations; }

export function locationDialog() {
  return `<dialog class="location-dialog" aria-labelledby="location-title"><div class="location-dialog-head">
    <h2 id="location-title">Manage locations</h2><button class="btn btn-primary location-add" type="button" data-location-add>+ Add</button><button class="dialog-close location-close" type="button" aria-label="Close" data-location-close>×</button></div>
    <div class="button-safe-scroll" data-location-body></div><p class="detail-note" data-location-error role="alert"></p></dialog>`;
}

function listView() {
  const body = document.querySelector('[data-location-body]');
  const add = document.querySelector('[data-location-add]');
  add.hidden = false;
  body.classList.add('location-list-body');
  document.getElementById('location-title').textContent = `Manage ${kind()}s`;
  body.innerHTML = `${items().length ? `<div class="location-list">${items().map(item => `<div class="location-row" data-location-id="${esc(item.id)}"><button class="location-drag-handle" type="button" aria-label="Reorder ${esc(item.name)}" aria-describedby="location-sort-help">⠿</button><span><strong>${esc(item.name)}</strong><small>${item.cardCount} ${item.cardCount === 1 ? 'card' : 'cards'}</small></span><details class="dropdown-control location-menu" data-dropdown-align="end"><summary aria-label="Options for ${esc(item.name)}"><span class="location-gear" aria-hidden="true"></span></summary><div class="dropdown-menu" role="menu"><button type="button" role="menuitem" data-location-cards="${esc(item.id)}">Manage cards</button><button type="button" role="menuitem" data-location-rename="${esc(item.id)}">Rename</button><button type="button" role="menuitem" data-location-delete="${esc(item.id)}">Delete</button></div></details></div>`).join('')}</div>` : `<p class="location-empty">No ${kind()}s yet.</p>`}`;
  body.insertAdjacentHTML('beforeend', '<p class="sr-only" id="location-sort-help">Press Space to pick up, arrow keys to move, and Space to drop. Press Escape to cancel.</p><p class="sr-only" data-location-sort-status aria-live="polite"></p>');
  initializeLocationSorting(body, saveOrder);
  add.onclick = () => editView();
  body.querySelectorAll('[data-location-cards]').forEach(button => { button.onclick = () => openCards(items().find(item => item.id === button.dataset.locationCards)); });
  body.querySelectorAll('[data-location-rename]').forEach(button => { button.onclick = () => editView(items().find(item => item.id === button.dataset.locationRename)); });
  body.querySelectorAll('[data-location-delete]').forEach(button => { button.onclick = () => deleteView(items().find(item => item.id === button.dataset.locationDelete)); });
}

async function saveOrder(ids) {
  if (busy) return false;
  busy = true;
  showError('');
  try { await request('PATCH', {order: ids}); await refresh(); return true; }
  catch (error) { showError(error.message); try { await refresh(); } catch {} return false; }
  finally { busy = false; }
}

function openCards(item) {
  document.querySelector('[data-location-body]').classList.remove('location-list-body');
  document.querySelector('[data-location-add]').hidden = true;
  const dialog = document.querySelector('.location-dialog');
  dialog.classList.add('location-picker');
  document.getElementById('location-title').textContent = `Manage cards · ${item.name}`;
  manageLocationCards(document.querySelector('[data-location-body]'), item, getCards(), async (add, remove) => {
    busy = true;
    try { await request('PUT', {id: item.id, add, remove}); await refresh(); }
    finally { busy = false; }
  }, () => { dialog.classList.remove('location-picker'); listView(); }, isCollection);
}

function editView(item) {
  document.querySelector('[data-location-body]').classList.remove('location-list-body');
  document.querySelector('[data-location-add]').hidden = true;
  showError('');
  const body = document.querySelector('[data-location-body]');
  body.innerHTML = `<form data-location-form><label class="form-field"><span>${item ? `Rename ${kind()}` : `New ${kind()}`} </span><input class="form-control" name="name" maxlength="120" required value="${esc(item?.name || '')}" placeholder="${isCollection ? 'e.g. Favorite cards' : 'e.g. Binder A'}"></label>
    <div class="two-choice-actions"><button type="button" class="btn btn-ghost" data-location-back>Cancel</button><button class="btn btn-primary" type="submit">${item ? 'Continue' : 'Add'}</button></div></form>`;
  body.querySelector('[data-location-back]').onclick = listView;
  body.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const name = event.target.elements.name.value.trim();
    if (!name) return showError(`Enter a ${kind()} name.`);
    if (items().some(location => location.id !== item?.id && location.name.toLowerCase() === name.toLowerCase())) return showError(`This ${kind()} already exists.`);
    if (item) renameView(item, name); else perform('POST', {name});
  };
  body.querySelector('input').focus();
}

function renameView(item, name) {
  showError('');
  const body = document.querySelector('[data-location-body]');
  body.innerHTML = `<h3>Rename ${kind()}?</h3><p class="two-choice-description">Rename ${esc(item.name)} to ${esc(name)} for all ${item.cardCount} ${item.cardCount === 1 ? 'card' : 'cards'} using this ${kind()}.</p><div class="two-choice-actions"><button class="btn btn-ghost" type="button" data-location-back>Cancel</button><button class="btn btn-primary" type="button" data-location-confirm>Rename</button></div>`;
  body.querySelector('[data-location-back]').onclick = listView;
  body.querySelector('[data-location-confirm]').onclick = () => perform('PATCH', {id: item.id, name});
}

function deleteView(item) {
  document.querySelector('[data-location-body]').classList.remove('location-list-body');
  document.querySelector('[data-location-add]').hidden = true;
  showError('');
  const body = document.querySelector('[data-location-body]');
  body.innerHTML = `<h3>Delete ${esc(item.name)}?</h3>${isCollection ? `<p class="two-choice-description">This deletes the collection. Its cards and their storage locations stay in your vault.</p>` : `<p class="two-choice-description">This removes the location from all ${item.cardCount} ${item.cardCount === 1 ? 'card' : 'cards'} using it. What should happen to their positions?</p>
    <fieldset class="location-choices" aria-label="Card positions"><label><input type="radio" name="clear-positions" value="false" checked> Keep positions</label><label><input type="radio" name="clear-positions" value="true"> Clear positions</label></fieldset>`}
    <div class="two-choice-actions"><button class="btn btn-ghost" type="button" data-location-back>Cancel</button><button class="btn btn-primary" type="button" data-location-confirm>Delete ${kind()}</button></div>`;
  body.querySelector('[data-location-back]').onclick = listView;
  body.querySelector('[data-location-confirm]').onclick = () => perform('DELETE', {id: item.id, clearPositions: body.querySelector('[name="clear-positions"]:checked')?.value === 'true'});
}

function showError(message) { document.querySelector('[data-location-error]').textContent = message; }
async function perform(method, data) {
  if (busy) return;
  busy = true;
  const dialog = document.querySelector('.location-dialog');
  dialog.querySelectorAll('button,input').forEach(element => { element.disabled = true; });
  showError('');
  try { await request(method, data); await refresh(); listView(); }
  catch (error) { showError(error.message); }
  finally { busy = false; dialog.querySelectorAll('button,input').forEach(element => { element.disabled = false; }); }
}

export function initializeLocations(onRefresh, canOpen = async () => true, cards = () => []) {
  getCards = cards;
  refresh = onRefresh;
  const dialog = document.querySelector('.location-dialog');
  if (!dialog?.querySelector('[data-location-close]')) return;
  dialog.querySelector('[data-location-close]').onclick = () => { if (!busy) dialog.close(); };
  dialog.oncancel = event => { if (busy) event.preventDefault(); };
  if (openerHandler) document.removeEventListener('click', openerHandler);
  openerHandler = async event => {
    const button = event.target.closest('[data-manage-locations], [data-manage-collections]');
    if (!button || !document.querySelector('.location-dialog')) return;
    button.closest('.dropdown-control').open = false;
    isCollection = button.hasAttribute('data-manage-collections');
    if (!await canOpen()) return;
    dialog.classList.remove('location-picker'); showError(''); listView(); dialog.showModal();
  };
  document.addEventListener('click', openerHandler);
}
