// Shared navigation for all DCR Card Vault pages.
import {escapeHTML} from '../utils/format.js';
import {signOut} from '../auth.js';
import {bindSignOut, signOutDialog} from './sign-out-dialog.js';

const items = [
  ['/', 'Home'],
  ['/archive', 'Add Card'],
  ['/vault', 'My Vault'],
  ['/label', 'Labels']
];

export function avatar(user, extraClass = '') {
  const initial = escapeHTML((user.displayName || user.email || '?').trim().charAt(0).toUpperCase());
  const image = user.avatarUrl ? `<img src="${escapeHTML(user.avatarUrl)}" alt="">` : initial;
  return `<span class="account-avatar ${extraClass}" aria-hidden="true">${image}</span>`;
}

const menuIcons = {
  Profile: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  Billing: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  Settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.6 2.77-.08-.02a1.7 1.7 0 0 0-1.8.64l-.04.07h-3.2l-.04-.07a1.7 1.7 0 0 0-1.8-.64l-.08.02-1.6-2.77.06-.06A1.7 1.7 0 0 0 9.96 15l-.08-.02v-3.2l.08-.02a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.6-2.77.08.02a1.7 1.7 0 0 0 1.8-.64l.04-.07h3.2l.04.07a1.7 1.7 0 0 0 1.8.64l.08-.02 1.6 2.77-.06.06a1.7 1.7 0 0 0-.34 1.88l.08.02v3.2z" transform="translate(-2 -1)"/>',
  Team: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/>',
  'Invite Members': '<path d="M12 5v14M5 12h14"/>',
  Support: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6m5.6 5.6 3.6 3.6m0-12.8-3.6 3.6m-5.6 5.6-3.6 3.6"/>',
  Documentation: '<path d="M12 6c-2-2-5-2-9-1v14c4-1 7-1 9 1m0-14c2-2 5-2 9-1v14c-4-1-7-1-9 1m0-14v14"/>',
  'Log out': '<path d="M10 17v3H4V4h6v3m4 1 4 4-4 4m4-4H8"/>'
};

function accountItem(label) {
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${menuIcons[label]}</svg>`;
  if (label === 'Profile' || label === 'Billing') return `<a href="/${label.toLowerCase()}">${icon}<span>${label}</span></a>`;
  return `<button type="button" ${label === 'Log out' ? 'data-sign-out' : ''}>${icon}<span>${label}</span></button>`;
}

function accountPopover(user) {
  const groups = [['Profile', 'Billing', 'Settings'], ['Team', 'Invite Members'], ['Support', 'Documentation'], ['Log out']];
  return `<div class="account-popover" id="account-popover" hidden><div class="account-identity">${avatar(user)}<div><strong>${escapeHTML(user.displayName || user.email)}</strong><small>${escapeHTML(user.email)}</small></div></div>${groups.map(group => `<div class="account-group">${group.map(accountItem).join('')}</div>`).join('')}</div>`;
}

export function header(activePath, user = null) {
  const links = items.map(([href, label]) => {
    const active = href === activePath;
    return `<a href="${href}" class="${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>${label}</a>`;
  }).join('');
  const account = user
    ? `<div class="account-menu"><button class="account-trigger" type="button" aria-expanded="false" aria-controls="account-popover">${avatar(user)}<span>${escapeHTML(user.displayName || user.email)}</span><span aria-hidden="true">▾</span></button>${accountPopover(user)}</div>`
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
    </header>${user ? signOutDialog() : ''}`;
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
  if (signOutButton) bindSignOut(signOutButton, document.querySelector('#sign-out-dialog'), signOut);
}
