import {avatar} from '../components/header.js';
import {escapeHTML} from '../utils/format.js';
import {initializeCrop} from '../components/profile-crop.js';

export function profile(user) {
  return `<main class="app-page profile-page"><header class="page-heading"><div class="page-eyebrow">YOUR ACCOUNT</div><h1>My profile</h1><p class="page-description">Manage your personal details and account.</p></header>
    <form class="profile-form" id="profile-form"><section class="surface-card profile-identity"><button type="button" id="profile-avatar" class="profile-avatar-button" aria-label="View profile photo" ${user.avatarUrl ? '' : 'disabled'}>${avatar(user, 'profile-avatar')}</button><div><h2>${escapeHTML(user.displayName || user.email)}</h2><p>${escapeHTML(user.email)}</p><div class="profile-photo-actions"><button class="btn btn-ghost" type="button" id="change-photo">Change photo</button><button class="profile-text-button" type="button" id="remove-photo">Remove photo</button></div><small>JPG, PNG or WebP, up to 5 MB.</small><p class="profile-photo-status" role="status" aria-live="polite"></p></div></section>
    <section class="surface-card profile-section"><div class="profile-section-heading"><h2>Personal details</h2><button class="profile-edit-button" id="profile-edit" type="button" aria-label="Edit personal details" title="Edit personal details" aria-expanded="false" aria-controls="profile-name-editor">⋯</button></div><div class="profile-name-label">Display name</div><p id="profile-name-display" class="profile-name-display">${escapeHTML(user.displayName || '')}</p><div id="profile-name-editor" hidden><label class="profile-name-accessible-label" for="profile-name">Display name</label><input id="profile-name" name="displayName" maxlength="12" required aria-describedby="profile-name-hint" value="${escapeHTML(user.displayName || '')}"><small id="profile-name-hint">Up to 12 characters.</small></div><div class="profile-actions" hidden><button class="btn btn-primary" type="submit">Save changes</button><button class="btn btn-ghost" type="button" id="profile-cancel">Cancel</button></div><p class="profile-status" role="status" aria-live="polite"></p></section>
    <section class="surface-card profile-section"><h2>Account</h2><dl><div><dt>Email</dt><dd>${escapeHTML(user.email)}</dd></div><div><dt>Sign-in method</dt><dd>Google</dd></div></dl><button class="profile-text-button" type="button" data-profile-sign-out>Sign out</button></section></form><dialog class="profile-photo-dialog" aria-label="Profile photo"><button type="button" class="profile-photo-close" aria-label="Close photo preview">×</button><img alt="Your profile photo"></dialog><dialog class="profile-crop-dialog" aria-labelledby="crop-title"><button type="button" class="profile-photo-close" data-crop-close aria-label="Close photo editor">×</button><h2 id="crop-title">Adjust profile photo</h2><p>Choose a photo, then drag it to position it inside the circle.</p><input id="crop-file" type="file" accept="image/jpeg,image/png,image/webp"><div class="profile-crop-area" hidden tabindex="0" aria-label="Photo position. Use arrow keys to move the image."><img alt=""><span class="profile-crop-guide"></span></div><div class="profile-actions"><button class="btn btn-primary" type="button" data-crop-save disabled>Save photo</button><button class="btn btn-ghost" type="button" data-crop-close>Cancel</button></div><p class="profile-crop-status" role="status" aria-live="polite"></p></dialog></main>`;
}

export function initializeProfile(user) {
  const form = document.querySelector('#profile-form');
  const name = form.querySelector('#profile-name');
  const status = form.querySelector('.profile-status');
  const photoStatus = form.querySelector('.profile-photo-status');
  const editor = form.querySelector('#profile-name-editor');
  const display = form.querySelector('#profile-name-display');
  const edit = form.querySelector('#profile-edit');
  const actions = form.querySelector('.profile-actions');
  const avatarButton = form.querySelector('#profile-avatar');
  const dialog = document.querySelector('.profile-photo-dialog');
  let current = {...user};
  const setEditing = active => { editor.hidden = !active; display.hidden = active; actions.hidden = !active; edit.setAttribute('aria-expanded', String(active)); };
  const render = () => {
    avatarButton.innerHTML = avatar(current, 'profile-avatar'); avatarButton.disabled = !current.avatarUrl;
    document.querySelector('.account-trigger').innerHTML = `${avatar(current)}<span>${escapeHTML(current.displayName)}</span><span aria-hidden="true">▾</span>`;
    form.querySelector('.profile-identity h2').textContent = current.displayName;
    document.querySelector('.account-popover strong').textContent = current.displayName;
  };
  const save = async changes => {
    const response = await fetch('/api/auth/profile', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(changes)});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save profile.');
    current = {...current, ...changes, ...(changes.displayName && {displayName: result.user.displayName})}; render();
  };
  avatarButton.onclick = () => { dialog.querySelector('img').src = current.avatarUrl; dialog.showModal(); };
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
  edit.onclick = () => { if (editor.hidden) { setEditing(true); name.focus(); } };
  form.querySelector('#profile-cancel').onclick = () => { name.value = current.displayName; status.textContent = ''; setEditing(false); };
  form.querySelector('#remove-photo').onclick = async event => {
    event.currentTarget.disabled = true; photoStatus.textContent = 'Saving…';
    try { await save({avatarUrl: ''}); photoStatus.textContent = 'Photo removed.'; }
    catch (error) { photoStatus.textContent = error.message; } finally { event.target.disabled = false; }
  };
  form.onsubmit = async event => {
    event.preventDefault(); const button = form.querySelector('[type="submit"]'); button.disabled = true; status.textContent = 'Saving…';
    try { await save({displayName: name.value}); name.value = current.displayName; display.textContent = current.displayName; setEditing(false); status.textContent = 'Personal details saved.'; }
    catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
  };
  initializeCrop(save, photoStatus);
  form.querySelector('[data-profile-sign-out]').onclick = () => document.querySelector('[data-sign-out]').click();
}
