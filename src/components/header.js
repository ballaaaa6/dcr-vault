// Shared navigation for all DCR Card Vault pages.
import {escapeHTML} from '../utils/format.js';
import {signOut} from '../auth.js';

const items = [
  ['/', 'Home'],
  ['/register', 'Add Card'],
  ['/vault', 'My Vault'],
  ['/label', 'Labels']
];

export function header(activePath, user = null) {
  const links = items.map(([href, label]) => {
    const active = href === activePath;
    return `<a href="${href}" class="${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>${label}</a>`;
  }).join('');
  const account = user
    ? `<span class="account-email">${escapeHTML(user.displayName || user.email)}</span><button class="account-link" type="button" data-sign-out>Sign out</button>`
    : '<a class="account-link" href="/login">Sign in</a>';

  return `
    <header class="site-header no-print">
      <div class="header-inner wrap">
        <a class="logo-wrap" href="/" aria-label="DCR Card Vault home">
          <img class="logo" src="/assets/logo/dcr-mark.svg" alt="">
          <span>DCR Card Vault</span>
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
  const signOutButton = document.querySelector('[data-sign-out]');
  if (signOutButton) signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try { await signOut(); } catch { signOutButton.disabled = false; }
  });
}
