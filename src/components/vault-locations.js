import {escapeHTML as esc} from '../utils/format.js';
import {locationsRequest} from '../store/locations.js';

let locations = [];
let refresh = () => {};
let busy = false;
let openerHandler = null;
export function setLocations(items) { locations = items; }
export function getLocations() { return locations; }

export function locationDialog() {
  return `<dialog class="location-dialog" aria-labelledby="location-title"><div class="location-dialog-head">
    <h2 id="location-title">Manage locations</h2><button class="btn btn-primary location-add" type="button" data-location-add>+ Add</button><button class="location-close" type="button" aria-label="Close" data-location-close>×</button></div>
    <div data-location-body></div><p class="detail-note" data-location-error role="alert"></p></dialog>`;
}

function listView() {
  const body = document.querySelector('[data-location-body]');
  const add = document.querySelector('[data-location-add]');
  add.hidden = false;
  body.innerHTML = `${locations.length ? `<div class="location-list">${locations.map(item => `<div class="location-row"><span><strong>${esc(item.name)}</strong><small>${item.cardCount} ${item.cardCount === 1 ? 'card' : 'cards'}</small></span><span class="location-row-actions"><button class="btn btn-ghost" type="button" data-location-rename="${esc(item.id)}">Rename</button><button class="btn btn-ghost" type="button" data-location-delete="${esc(item.id)}">Delete</button></span></div>`).join('')}</div>` : '<p class="location-empty">No locations yet.</p>'}`;
  add.onclick = () => editView();
  body.querySelectorAll('[data-location-rename]').forEach(button => { button.onclick = () => editView(locations.find(item => item.id === button.dataset.locationRename)); });
  body.querySelectorAll('[data-location-delete]').forEach(button => { button.onclick = () => deleteView(locations.find(item => item.id === button.dataset.locationDelete)); });
}

function editView(item) {
  document.querySelector('[data-location-add]').hidden = true;
  showError('');
  const body = document.querySelector('[data-location-body]');
  body.innerHTML = `<form data-location-form><label class="form-field"><span>${item ? 'Rename location' : 'New location'}</span><input class="form-control" name="name" maxlength="120" required value="${esc(item?.name || '')}" placeholder="e.g. Binder A"></label>
    <div class="two-choice-actions"><button type="button" class="btn btn-ghost" data-location-back>Cancel</button><button class="btn btn-primary" type="submit">${item ? 'Continue' : 'Add'}</button></div></form>`;
  body.querySelector('[data-location-back]').onclick = listView;
  body.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const name = event.target.elements.name.value.trim();
    if (!name) return showError('Enter a location name.');
    if (locations.some(location => location.id !== item?.id && location.name.toLowerCase() === name.toLowerCase())) return showError('This location already exists.');
    if (item) renameView(item, name); else perform('POST', {name});
  };
  body.querySelector('input').focus();
}

function renameView(item, name) {
  showError('');
  const body = document.querySelector('[data-location-body]');
  body.innerHTML = `<h3>Rename location?</h3><p class="two-choice-description">Rename ${esc(item.name)} to ${esc(name)} for all ${item.cardCount} ${item.cardCount === 1 ? 'card' : 'cards'} using this location.</p><div class="two-choice-actions"><button class="btn btn-ghost" type="button" data-location-back>Cancel</button><button class="btn btn-primary" type="button" data-location-confirm>Rename</button></div>`;
  body.querySelector('[data-location-back]').onclick = listView;
  body.querySelector('[data-location-confirm]').onclick = () => perform('PATCH', {id: item.id, name});
}

function deleteView(item) {
  document.querySelector('[data-location-add]').hidden = true;
  showError('');
  const body = document.querySelector('[data-location-body]');
  body.innerHTML = `<h3>Delete ${esc(item.name)}?</h3><p class="two-choice-description">This removes the location from all ${item.cardCount} ${item.cardCount === 1 ? 'card' : 'cards'} using it. What should happen to their positions?</p>
    <fieldset class="location-choices" aria-label="Card positions"><label><input type="radio" name="clear-positions" value="false" checked> Keep positions</label><label><input type="radio" name="clear-positions" value="true"> Clear positions</label></fieldset>
    <div class="two-choice-actions"><button class="btn btn-ghost" type="button" data-location-back>Cancel</button><button class="btn btn-primary" type="button" data-location-confirm>Delete location</button></div>`;
  body.querySelector('[data-location-back]').onclick = listView;
  body.querySelector('[data-location-confirm]').onclick = () => perform('DELETE', {id: item.id, clearPositions: body.querySelector('[name="clear-positions"]:checked').value === 'true'});
}

function showError(message) { document.querySelector('[data-location-error]').textContent = message; }
async function perform(method, data) {
  if (busy) return;
  busy = true;
  const dialog = document.querySelector('.location-dialog');
  dialog.querySelectorAll('button,input').forEach(element => { element.disabled = true; });
  showError('');
  try { await locationsRequest(method, data); await refresh(); listView(); }
  catch (error) { showError(error.message); }
  finally { busy = false; dialog.querySelectorAll('button,input').forEach(element => { element.disabled = false; }); }
}

export function initializeLocations(onRefresh, canOpen = async () => true) {
  refresh = onRefresh;
  const dialog = document.querySelector('.location-dialog');
  if (!dialog?.querySelector('[data-location-close]')) return;
  dialog.querySelector('[data-location-close]').onclick = () => { if (!busy) dialog.close(); };
  dialog.oncancel = event => { if (busy) event.preventDefault(); };
  if (openerHandler) document.removeEventListener('click', openerHandler);
  openerHandler = async event => {
    const button = event.target.closest('[data-manage-locations]');
    if (!button || !document.querySelector('.location-dialog')) return;
    button.closest('.dropdown-control').open = false;
    if (!await canOpen()) return;
    showError(''); listView(); dialog.showModal();
  };
  document.addEventListener('click', openerHandler);
}
