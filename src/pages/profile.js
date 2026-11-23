import {avatar} from '../components/header.js';
import {escapeHTML} from '../utils/format.js';
import {displayDate} from '../components/date-picker.js';
import {initializeCrop} from '../components/profile-crop.js';
import {inlineEdit, initializeInlineEdit} from '../components/inline-edit.js';

function collectingDate(value) {
  if (!value) return 'Add when you started collecting';
  const [year, month, day] = value.split('-').map(Number);
  const today = new Date();
  const days = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(year, month - 1, day)) / 86400000);
  return `${displayDate(value)} (${days} ${days === 1 ? 'day' : 'days'})`;
}

const detailFields = [
  {key: 'favoriteSeries', id: 'profile-series', label: 'Favorite series', placeholder: 'Add your favorite series', maxLength: 80},
  {key: 'bio', id: 'profile-bio', label: 'Short bio', placeholder: 'Add a short bio', maxLength: 240, inputType: 'textarea'},
  {key: 'collectingSince', id: 'profile-since', label: 'Collecting since', inputType: 'date'},
  {key: 'collectionGoal', id: 'profile-goal', label: 'Collection goal', placeholder: 'Add your collection goal', maxLength: 240, inputType: 'textarea'},
];

function detailDisplay(field, value) {
  return field.inputType === 'date' ? collectingDate(value) : value || field.placeholder;
}

function profileDetails(user) {
  return detailFields.map(field => `<div><dt>${field.label}</dt><dd>${inlineEdit({...field, value: user[field.key] || '', displayValue: detailDisplay(field, user[field.key])})}</dd></div>`).join('');
}

function initializeDetails(form, getCurrent, save) {
  for (const field of detailFields) {
    const row = form.querySelector(`#${field.id}-display`).closest('[data-inline-edit]');
    initializeInlineEdit(row, {getValue: () => getCurrent()[field.key], save: value => save({[field.key]: value}), formatValue: value => detailDisplay(field, value)});
  }
}

export function profile(user, cards) {
  const joined = new Intl.DateTimeFormat('en-US', {month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(user.createdAt * 1000));
  const summary = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} · Member since ${joined}`;
  return `<main class="app-page profile-page"><header class="page-heading"><h1>My profile</h1><p class="page-description">Manage your personal details and account.</p></header>
    <form class="profile-form" id="profile-form"><section class="surface-card profile-identity"><div class="profile-avatar-wrap" data-has-photo="${Boolean(user.avatarUrl)}"><button type="button" id="profile-avatar" class="profile-avatar-button" aria-label="${user.avatarUrl ? 'View profile photo' : 'Add profile photo'}">${avatar(user, 'profile-avatar')}<span class="profile-avatar-add" aria-hidden="true">+</span></button><button type="button" id="remove-photo" class="profile-avatar-remove" aria-label="Remove profile photo" ${user.avatarUrl ? '' : 'hidden'}>×</button><input id="crop-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></div><div>${inlineEdit({id: 'profile-name', label: 'Display name', value: user.displayName || '', displayValue: user.displayName || user.email, maxLength: 20, required: true, displayTag: 'h2'})}<p>${escapeHTML(user.email)}</p><small>${summary}</small><p class="profile-photo-status" role="status" aria-live="polite"></p></div></section>
    <section class="surface-card profile-section"><h2>Personal details</h2><dl>${profileDetails(user)}</dl></section>
    </form><dialog class="profile-crop-dialog profile-remove-dialog two-choice-dialog" aria-labelledby="remove-photo-title"><h2 id="remove-photo-title">Remove profile photo?</h2><p class="two-choice-description">This will remove your photo.</p><div class="profile-actions two-choice-actions"><button class="btn btn-primary" type="button" data-remove-confirm>Remove photo</button><button class="btn btn-ghost" type="button" data-remove-cancel>Cancel</button></div></dialog><dialog class="profile-photo-dialog" aria-label="Profile photo"><button type="button" class="profile-photo-close" aria-label="Close photo preview">×</button><img alt="Your profile photo"></dialog><dialog class="profile-crop-dialog two-choice-dialog" aria-labelledby="crop-title"><button type="button" class="profile-photo-close" data-crop-close aria-label="Close photo editor">×</button><h2 id="crop-title">Adjust profile photo</h2><p class="two-choice-description">Drag the photo to position it inside the circle.</p><div class="profile-crop-area" hidden><img alt=""><span class="profile-crop-guide"></span></div><div class="profile-actions two-choice-actions"><button class="btn btn-primary" type="button" data-crop-save disabled>Save photo</button><button class="btn btn-ghost" type="button" data-crop-close>Cancel</button></div><p class="profile-crop-status" role="status" aria-live="polite"></p></dialog></main>`;
}

function renderProfile(form, avatarButton, current) {
  avatarButton.innerHTML = `${avatar(current, 'profile-avatar')}<span class="profile-avatar-add" aria-hidden="true">+</span>`;
  avatarButton.setAttribute('aria-label', current.avatarUrl ? 'View profile photo' : 'Add profile photo');
  avatarButton.parentElement.dataset.hasPhoto = String(Boolean(current.avatarUrl));
  form.querySelector('#remove-photo').hidden = !current.avatarUrl;
  document.querySelector('.account-trigger').innerHTML = `${avatar(current)}<span>${escapeHTML(current.displayName)}</span><span aria-hidden="true">▾</span>`;
  form.querySelector('.profile-identity h2').textContent = current.displayName;
  document.querySelector('.account-popover strong').textContent = current.displayName;
  document.querySelector('.account-identity .account-avatar').outerHTML = avatar(current);
}

export function initializeProfile(user) {
  const form = document.querySelector('#profile-form');
  const photoStatus = form.querySelector('.profile-photo-status');
  const avatarButton = form.querySelector('#profile-avatar');
  const dialog = document.querySelector('.profile-photo-dialog');
  let current = {...user};
  const render = () => renderProfile(form, avatarButton, current);
  const save = async changes => {
    const response = await fetch('/api/auth/profile', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(changes)});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save profile.');
    current = {...current, ...result.user}; render();
  };
  avatarButton.onclick = () => { if (current.avatarUrl) { dialog.querySelector('img').src = current.avatarUrl; dialog.showModal(); } else { document.querySelector('#crop-file').click(); } };
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
  initializeInlineEdit(form.querySelector('[data-inline-edit]'), {getValue: () => current.displayName, save: value => save({displayName: value})});
  initializeDetails(form, () => current, save);
  const removeDialog = document.querySelector('.profile-remove-dialog');
  const removeConfirm = removeDialog.querySelector('[data-remove-confirm]');
  form.querySelector('#remove-photo').onclick = () => removeDialog.showModal();
  removeDialog.querySelector('[data-remove-cancel]').onclick = () => removeDialog.close();
  removeConfirm.onclick = async () => {
    removeConfirm.disabled = true; photoStatus.textContent = 'Saving…';
    try { await save({avatarUrl: ''}); removeDialog.close(); photoStatus.textContent = 'Photo removed.'; }
    catch (error) { removeDialog.close(); photoStatus.textContent = error.message; } finally { removeConfirm.disabled = false; }
  };
  initializeCrop(save, photoStatus);
}
