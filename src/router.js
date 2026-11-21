import {header, bindHeader} from './components/header.js';
import {getCurrentUser} from './auth.js';
import {home} from './pages/home.js';
import {initializeSearchPage, search} from './pages/search.js';
import {vault} from './pages/vault.js';
import {label} from './pages/label.js';
import {loginPage, initializeLogin} from './pages/login.js';
import {verify} from './pages/verify.js';
import {importPage} from './pages/import.js';
import {getCards} from './store/cards.js';
import {addVaultImages} from './store/vault-images.js';
import {escapeHTML} from './utils/format.js';

let renderVersion = 0;
const privatePaths = new Set(['#/search', '#/vault', '#/label', '#/verify', '#/import']);

function footer() {
  return `<footer class="site-footer no-print"><span>© ${new Date().getFullYear()} DCR Card Vault</span><span>Card records are private to your account.</span></footer>`;
}

function failurePage(error) {
  return `<main class="app-page"><section class="surface-card"><div class="page-eyebrow">VAULT UNAVAILABLE</div><h1>We couldn’t load your collection.</h1><p class="page-description">${escapeHTML(error.message || 'Please try again in a moment.')}</p><button class="btn btn-primary" type="button" onclick="location.reload()">Try again</button></section></main>`;
}

function loginHash(hash) {
  location.hash = `#/login?next=${encodeURIComponent(hash)}`;
}

export async function render() {
  const version = ++renderVersion;
  const hash = location.hash || '#/';
  const path = hash.split('?')[0];
  const app = document.getElementById('app');
  if (path === '#/login') {
    app.innerHTML = loginPage();
    await initializeLogin();
    return;
  }

  let user = null;
  try { user = await getCurrentUser(); } catch {}
  if (version !== renderVersion || (location.hash || '#/') !== hash) return;
  if (privatePaths.has(path) && !user) { loginHash(hash); return; }

  let content = home();
  try {
    if (path === '#/search') content = search();
    else if (path === '#/import') content = importPage(user);
    else if (['#/vault', '#/label', '#/verify'].includes(path)) content = await privatePage(path);
  } catch (error) { content = failurePage(error); }
  if (version !== renderVersion || (location.hash || '#/') !== hash) return;
  app.innerHTML = header(path, user) + content + footer();
  bindHeader();
  if (path === '#/search') initializeSearchPage();
  window.scrollTo(0, 0);
}

async function privatePage(path) {
  const cards = await getCards();
  if (path === '#/vault') return vault(await addVaultImages(cards));
  if (path === '#/label') return label(cards);
  return verify(cards);
}

window.addEventListener('hashchange', render);
