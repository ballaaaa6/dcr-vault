import {avatar} from '../components/header.js';
import {escapeHTML} from '../utils/format.js';

export function profile(user) {
  return `<main class="app-page profile-page"><header class="page-heading"><div class="page-eyebrow">YOUR ACCOUNT</div><h1>My profile</h1><p class="page-description">Manage your personal details and account.</p></header>
    <form class="profile-form" id="profile-form"><section class="surface-card profile-identity"><button type="button" id="profile-avatar" class="profile-avatar-button" aria-label="View profile photo" ${user.avatarUrl ? '' : 'disabled'}>${avatar(user, 'profile-avatar')}</button><div><h2>${escapeHTML(user.displayName || user.email)}</h2><p>${escapeHTML(user.email)}</p><div class="profile-photo-actions"><label class="btn btn-ghost" for="profile-photo">Change photo</label><input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden><button class="profile-text-button" type="button" id="remove-photo">Remove photo</button></div><small>JPG, PNG or WebP, up to 5 MB.</small></div></section>
    <section class="surface-card profile-section"><div class="profile-section-heading"><h2>Personal details</h2><button class="profile-edit-button" id="profile-edit" type="button" aria-label="Edit personal details" title="Edit personal details" aria-expanded="false" aria-controls="profile-name-editor">⋯</button></div><div class="profile-name-label">Display name</div><p id="profile-name-display" class="profile-name-display">${escapeHTML(user.displayName || '')}</p><div id="profile-name-editor" hidden><label class="profile-name-accessible-label" for="profile-name">Display name</label><input id="profile-name" name="displayName" maxlength="12" required aria-describedby="profile-name-hint" value="${escapeHTML(user.displayName || '')}"><small id="profile-name-hint">Up to 12 characters.</small></div><div class="profile-actions" hidden><button class="btn btn-primary" type="submit">Save changes</button><button class="btn btn-ghost" type="button" id="profile-cancel">Cancel</button></div><p class="profile-status" role="status" aria-live="polite"></p></section>
    <section class="surface-card profile-section"><h2>Account</h2><dl><div><dt>Email</dt><dd>${escapeHTML(user.email)}</dd></div><div><dt>Sign-in method</dt><dd>Google</dd></div></dl><button class="profile-text-button" type="button" data-profile-sign-out>Sign out</button></section></form><dialog class="profile-photo-dialog" aria-label="Profile photo"><button type="button" class="profile-photo-close" aria-label="Close photo preview">×</button><img alt="Your profile photo"></dialog></main>`;
}

export function initializeProfile(user) {
  const form = document.querySelector('#profile-form');
  const photo = form.querySelector('#profile-photo');
  const name = form.querySelector('#profile-name');
  const status = form.querySelector('.profile-status');
  const edit = form.querySelector('#profile-edit');
  const editor = form.querySelector('#profile-name-editor');
  const display = form.querySelector('#profile-name-display');
  const actions = form.querySelector('.profile-actions');
  let current = {...user};
  let pendingAvatar = current.avatarUrl;
  const avatarButton = form.querySelector('#profile-avatar');
  const dialog = document.querySelector('.profile-photo-dialog');
  const preview = () => { avatarButton.innerHTML = avatar({...current, displayName: name.value, avatarUrl: pendingAvatar}, 'profile-avatar'); avatarButton.disabled = !pendingAvatar; };
  avatarButton.onclick = () => { dialog.querySelector('img').src = pendingAvatar; dialog.showModal(); };
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
  const setEditing = active => { editor.hidden = !active; display.hidden = active; edit.setAttribute('aria-expanded', String(active)); actions.hidden = !active && pendingAvatar === current.avatarUrl; };
  edit.onclick = () => { if (editor.hidden) { setEditing(true); name.focus(); } };
  form.querySelector('#remove-photo').onclick = () => { pendingAvatar = ''; photo.value = ''; preview(); setEditing(!editor.hidden); };
  form.querySelector('#profile-cancel').onclick = () => { name.value = current.displayName; pendingAvatar = current.avatarUrl; photo.value = ''; status.textContent = ''; preview(); setEditing(false); };
  photo.onchange = async () => {
    if (!photo.files[0]) return;
    try { pendingAvatar = await preparePhoto(photo.files[0]); preview(); setEditing(!editor.hidden); status.textContent = 'Photo ready to save.'; }
    catch (error) { status.textContent = error.message; photo.value = ''; }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (name.value.trim().length > 12) { status.textContent = 'Enter a display name of up to 12 characters.'; name.focus(); return; }
    const button = form.querySelector('[type="submit"]'); button.disabled = true; status.textContent = 'Saving…';
    try {
      const response = await fetch('/api/auth/profile', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({displayName: name.value, avatarUrl: pendingAvatar})});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save profile.');
      current = result.user; pendingAvatar = current.avatarUrl; name.value = current.displayName; display.textContent = current.displayName; setEditing(false); status.textContent = 'Profile saved.';
      document.querySelector('.account-trigger').innerHTML = `${avatar(current)}<span>${escapeHTML(current.displayName)}</span><span aria-hidden="true">▾</span>`;
      form.querySelector('.profile-identity h2').textContent = current.displayName;
      document.querySelector('.account-popover strong').textContent = current.displayName;
    } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
  };
  form.querySelector('[data-profile-sign-out]').onclick = () => document.querySelector('[data-sign-out]').click();
}

async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP photo under 5 MB.');
  const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
return canvas.toDataURL('image/jpeg', 0.8);
}
