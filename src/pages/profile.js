import {avatar} from '../components/header.js';
import {escapeHTML} from '../utils/format.js';

export function profile(user) {
  return `<main class="app-page profile-page"><header class="page-heading"><div class="page-eyebrow">YOUR ACCOUNT</div><h1>My profile</h1><p class="page-description">Manage your personal details and account.</p></header>
    <form class="profile-form" id="profile-form"><section class="surface-card profile-identity"><div id="profile-avatar">${avatar(user, 'profile-avatar')}</div><div><h2>${escapeHTML(user.displayName || user.email)}</h2><p>${escapeHTML(user.email)}</p><div class="profile-photo-actions"><label class="btn btn-ghost" for="profile-photo">Change photo</label><input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden><button class="profile-text-button" type="button" id="remove-photo">Remove photo</button></div><small>JPG, PNG or WebP, up to 5 MB.</small></div></section>
    <section class="surface-card profile-section"><h2>Personal details</h2><label for="profile-name">Display name</label><input id="profile-name" name="displayName" maxlength="80" required value="${escapeHTML(user.displayName || '')}"><div class="profile-actions"><button class="btn btn-primary" type="submit">Save changes</button><button class="btn btn-ghost" type="button" id="profile-cancel">Cancel</button></div><p class="profile-status" role="status" aria-live="polite"></p></section>
    <section class="surface-card profile-section"><h2>Account</h2><dl><div><dt>Email</dt><dd>${escapeHTML(user.email)}</dd></div><div><dt>Sign-in method</dt><dd>Google</dd></div></dl><button class="profile-text-button" type="button" data-profile-sign-out>Sign out</button></section></form></main>`;
}

export function initializeProfile(user) {
  const form = document.querySelector('#profile-form');
  const photo = form.querySelector('#profile-photo');
  const name = form.querySelector('#profile-name');
  const status = form.querySelector('.profile-status');
  let current = {...user};
  let pendingAvatar = current.avatarUrl;
  const preview = () => { form.querySelector('#profile-avatar').innerHTML = avatar({...current, displayName: name.value, avatarUrl: pendingAvatar}, 'profile-avatar'); };
  form.querySelector('#remove-photo').onclick = () => { pendingAvatar = ''; photo.value = ''; preview(); };
  form.querySelector('#profile-cancel').onclick = () => { name.value = current.displayName; pendingAvatar = current.avatarUrl; photo.value = ''; status.textContent = ''; preview(); };
  photo.onchange = async () => {
    if (!photo.files[0]) return;
    try { pendingAvatar = await preparePhoto(photo.files[0]); preview(); status.textContent = 'Photo ready to save.'; }
    catch (error) { status.textContent = error.message; photo.value = ''; }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'); button.disabled = true; status.textContent = 'Saving…';
    try {
      const response = await fetch('/api/auth/profile', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({displayName: name.value, avatarUrl: pendingAvatar})});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save profile.');
      current = result.user; pendingAvatar = current.avatarUrl; status.textContent = 'Profile saved.';
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
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext('2d'); const size = Math.min(bitmap.width, bitmap.height);
  context.fillStyle = '#fff'; context.fillRect(0, 0, 256, 256);
  context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256); bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8);
}
