import {avatar} from '../components/header.js';
import {escapeHTML} from '../utils/format.js';
import {datePicker, displayDate, initializeDatePicker} from '../components/date-picker.js';
import {initializeCrop} from '../components/profile-crop.js';

function collectingDate(value) {
  if (!value) return 'Add when you started collecting';
  const [year, month, day] = value.split('-').map(Number);
  const today = new Date();
  const days = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(year, month - 1, day)) / 86400000);
  return `${displayDate(value)} (${days} ${days === 1 ? 'day' : 'days'})`;
}

export function profile(user) {
  return `<main class="app-page profile-page"><header class="page-heading"><h1>My profile</h1><p class="page-description">Manage your personal details and account.</p></header>
    <form class="profile-form" id="profile-form"><section class="surface-card profile-identity"><button type="button" id="profile-avatar" class="profile-avatar-button" aria-label="View profile photo" ${user.avatarUrl ? '' : 'disabled'}>${avatar(user, 'profile-avatar')}</button><div><div class="profile-name-row"><h2 id="profile-name-display">${escapeHTML(user.displayName || user.email)}</h2><button class="profile-pencil" id="profile-name-edit" type="button" aria-label="Edit display name" aria-expanded="false" aria-controls="profile-name-editor">✎</button><div id="profile-name-editor" hidden><label class="profile-name-accessible-label" for="profile-name">Display name</label><input id="profile-name" maxlength="20" required value="${escapeHTML(user.displayName || '')}"><button class="btn btn-primary" type="button" id="profile-name-save">Save</button><button class="btn btn-ghost" type="button" id="profile-name-cancel">Cancel</button></div></div><p class="profile-name-status" role="status" aria-live="polite"></p><p>${escapeHTML(user.email)}</p><div class="profile-photo-actions"><button class="btn btn-ghost" type="button" id="change-photo">Change photo</button><input id="crop-file" type="file" accept="image/jpeg,image/png,image/webp" hidden><button class="profile-text-button" type="button" id="remove-photo">Remove photo</button></div><small>JPG, PNG or WebP, up to 5 MB.</small><p class="profile-photo-status" role="status" aria-live="polite"></p></div></section>
    <section class="surface-card profile-section"><div class="profile-section-heading"><h2>Personal details</h2><button class="profile-edit-button" id="profile-edit" type="button" aria-label="Edit personal details" title="Edit personal details" aria-expanded="false" aria-controls="profile-details-editor">⋯</button></div><dl id="profile-details-display"><div><dt>Favorite series</dt><dd>${escapeHTML(user.favoriteSeries || 'Add your favorite series')}</dd></div><div><dt>Short bio</dt><dd>${escapeHTML(user.bio || 'Add a short bio')}</dd></div><div><dt>Collecting since</dt><dd>${escapeHTML(collectingDate(user.collectingSince))}</dd></div><div><dt>Collection goal</dt><dd>${escapeHTML(user.collectionGoal || 'Add your collection goal')}</dd></div></dl><div id="profile-details-editor" hidden><label for="profile-series">Favorite series</label><input id="profile-series" maxlength="80" value="${escapeHTML(user.favoriteSeries || '')}" placeholder="Your favorite series"><label for="profile-bio">Short bio</label><textarea id="profile-bio" maxlength="240" rows="3" placeholder="Tell us a little about your collection">${escapeHTML(user.bio || '')}</textarea>${datePicker(user.collectingSince || '', {name: 'collectingSince', label: 'Collecting since', id: 'collecting-since'})}<label for="profile-goal">Collection goal</label><textarea id="profile-goal" maxlength="240" rows="3" placeholder="What are you collecting toward?">${escapeHTML(user.collectionGoal || '')}</textarea><div class="profile-actions"><button class="btn btn-primary" type="submit">Save changes</button><button class="btn btn-ghost" type="button" id="profile-cancel">Cancel</button></div></div><p class="profile-status" role="status" aria-live="polite"></p></section>
    </form><dialog class="profile-photo-dialog" aria-label="Profile photo"><button type="button" class="profile-photo-close" aria-label="Close photo preview">×</button><img alt="Your profile photo"></dialog><dialog class="profile-crop-dialog" aria-labelledby="crop-title"><button type="button" class="profile-photo-close" data-crop-close aria-label="Close photo editor">×</button><h2 id="crop-title">Adjust profile photo</h2><p>Drag the photo to position it inside the circle.</p><div class="profile-crop-area" hidden><img alt=""><span class="profile-crop-guide"></span></div><div class="profile-actions"><button class="btn btn-primary" type="button" data-crop-save disabled>Save photo</button><button class="btn btn-ghost" type="button" data-crop-close>Cancel</button></div><p class="profile-crop-status" role="status" aria-live="polite"></p></dialog></main>`;
}

function renderProfile(form, avatarButton, current) {
  avatarButton.innerHTML = avatar(current, 'profile-avatar'); avatarButton.disabled = !current.avatarUrl;
  document.querySelector('.account-trigger').innerHTML = `${avatar(current)}<span>${escapeHTML(current.displayName)}</span><span aria-hidden="true">▾</span>`;
  form.querySelector('.profile-identity h2').textContent = current.displayName;
  document.querySelector('.account-popover strong').textContent = current.displayName;
  document.querySelector('.account-identity .account-avatar').outerHTML = avatar(current);
}

function initializeNameEditor(form, name, nameEdit, nameStatus, setNameEditing, save, getCurrent) {
  name.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); form.querySelector('#profile-name-save').click(); } };
  nameEdit.onclick = () => { setNameEditing(true); nameStatus.textContent = ''; name.focus(); };
  form.querySelector('#profile-name-cancel').onclick = () => { name.value = getCurrent().displayName; nameStatus.textContent = ''; setNameEditing(false); };
  form.querySelector('#profile-name-save').onclick = async event => {
    if (!name.reportValidity()) return;
    event.currentTarget.disabled = true; nameStatus.textContent = '';
    try { await save({displayName: name.value}); name.value = getCurrent().displayName; setNameEditing(false); nameStatus.textContent = ''; }
    catch (error) { nameStatus.textContent = error.message; } finally { event.target.disabled = false; }
  };
}

export function initializeProfile(user) {
  const form = document.querySelector('#profile-form');
  const name = form.querySelector('#profile-name');
  const status = form.querySelector('.profile-status');
  const photoStatus = form.querySelector('.profile-photo-status');
  const editor = form.querySelector('#profile-name-editor');
  const display = form.querySelector('#profile-name-display');
  const nameEdit = form.querySelector('#profile-name-edit');
  const nameStatus = form.querySelector('.profile-name-status');
  const details = form.querySelector('#profile-details-display');
  const detailsEditor = form.querySelector('#profile-details-editor');
  const series = form.querySelector('#profile-series');
  const bio = form.querySelector('#profile-bio');
  const since = form.querySelector('[name=collectingSince]');
  const goal = form.querySelector('#profile-goal');
  initializeDatePicker(form);
  const edit = form.querySelector('#profile-edit');
  const avatarButton = form.querySelector('#profile-avatar');
  const dialog = document.querySelector('.profile-photo-dialog');
  let current = {...user};
  const setNameEditing = active => { editor.hidden = !active; display.hidden = active; nameEdit.hidden = active; nameEdit.setAttribute('aria-expanded', String(active)); };
  const setDetailsEditing = active => { detailsEditor.hidden = !active; details.hidden = active; edit.setAttribute('aria-expanded', String(active)); };
  const render = () => renderProfile(form, avatarButton, current);
  const save = async changes => {
    const response = await fetch('/api/auth/profile', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(changes)});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save profile.');
    current = {...current, ...result.user}; render();
  };
  avatarButton.onclick = () => { dialog.querySelector('img').src = current.avatarUrl; dialog.showModal(); };
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
  initializeNameEditor(form, name, nameEdit, nameStatus, setNameEditing, save, () => current);
  edit.onclick = () => { if (detailsEditor.hidden) { setDetailsEditing(true); series.focus(); } };
  form.querySelector('#profile-cancel').onclick = () => { series.value = current.favoriteSeries || ''; bio.value = current.bio || ''; since.value = current.collectingSince || ''; form.querySelector('[data-date-value]').textContent = displayDate(since.value); goal.value = current.collectionGoal || ''; status.textContent = ''; setDetailsEditing(false); };
  form.querySelector('#remove-photo').onclick = async event => {
    event.currentTarget.disabled = true; photoStatus.textContent = 'Saving…';
    try { await save({avatarUrl: ''}); photoStatus.textContent = 'Photo removed.'; }
    catch (error) { photoStatus.textContent = error.message; } finally { event.target.disabled = false; }
  };
  form.onsubmit = async event => {
    event.preventDefault(); const button = form.querySelector('[type="submit"]'); button.disabled = true; status.textContent = 'Saving…';
    try { await save({favoriteSeries: series.value, bio: bio.value, collectingSince: since.value, collectionGoal: goal.value}); details.querySelectorAll('dd')[0].textContent = current.favoriteSeries || 'Add your favorite series'; details.querySelectorAll('dd')[1].textContent = current.bio || 'Add a short bio'; details.querySelectorAll('dd')[2].textContent = collectingDate(current.collectingSince); details.querySelectorAll('dd')[3].textContent = current.collectionGoal || 'Add your collection goal'; setDetailsEditing(false); status.textContent = 'Personal details saved.'; }
    catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
  };
  initializeCrop(save, photoStatus);
}
