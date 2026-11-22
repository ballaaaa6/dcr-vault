// Shared navigation for all DCR Card Vault pages.
import {escapeHTML} from '../utils/format.js';
import {signOut} from '../auth.js';

const items = [
  ['/', 'Home'],
  ['/register', 'Add Card'],
  ['/vault', 'My Vault'],
  ['/label', 'Labels']
];

export function avatar(user, extraClass = '') {
  const initial = escapeHTML((user.displayName || user.email || '?').trim().charAt(0).toUpperCase());
  const image = user.avatarUrl ? `<img src="${escapeHTML(user.avatarUrl)}" alt="">` : initial;
  return `<span class="account-avatar ${extraClass}" aria-hidden="true">${image}</span>`;
}

export function header(activePath, user = null) {
  const links = items.map(([href, label]) => {
    const active = href === activePath;
    return `<a href="${href}" class="${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>${label}</a>`;
  }).join('');
  const account = user
    ? `<div class="account-menu"><button class="account-trigger" type="button" aria-expanded="false" aria-controls="account-popover">${avatar(user)}<span>${escapeHTML(user.displayName || user.email)}</span><span aria-hidden="true">▾</span></button><div class="account-popover" id="account-popover" hidden><strong>${escapeHTML(user.displayName || user.email)}</strong><small>${escapeHTML(user.email)}</small><a href="/profile">My profile</a><button type="button" data-sign-out>Sign out</button></div></div>`
    : '<a class="account-link" href="/login">Sign in</a>';

  return `
    <header class="site-header no-print">
      <div class="header-inner wrap">
        <a class="logo-wrap" href="/" aria-label="Distinguished Card Registry home">
          <img class="logo" src="/assets/logo/dcr-mark.svg" alt="">
          <span>Distinguished Card Registry</span>
        </a>
        <button class="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open navigation">
          <span></span><span></span><span></span>
        </button>
        <nav class="site-nav" id="site-nav" aria-label="Main navigation">
          ${links}
          ${account}
        </nav>
      </div>
    </header>`;
}

export function bindHeader() {
  const headerElement = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  if (!headerElement || !toggle) return;

  const closeMenu = () => {
    headerElement.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  };

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    headerElement.classList.toggle('menu-open', !expanded);
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  });
  document.querySelectorAll('.site-nav a').forEach(link => link.addEventListener('click', closeMenu));
  const trigger = document.querySelector('.account-trigger');
  const popover = document.querySelector('.account-popover');
  if (trigger && popover) {
    const close = () => { popover.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
    trigger.addEventListener('click', () => { const open = popover.hidden; popover.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('click', event => { if (!event.target.closest('.account-menu')) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !popover.hidden) { close(); trigger.focus(); } });
  }
  const signOutButton = document.querySelector('[data-sign-out]');
  if (signOutButton) signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try { await signOut(); } catch { signOutButton.disabled = false; }
  });
}
