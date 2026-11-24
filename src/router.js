import {header, bindHeader} from './components/header.js';
import {getCurrentUser} from './auth.js';
import {home} from './pages/home.js';
import {billing} from './pages/billing.js';
import {geminiUsage, initializeGeminiUsage} from './pages/gemini-usage.js';
import {profile, initializeProfile} from './pages/profile.js';
import {initializeSearchPage, search} from './pages/search.js';
import {destroyCatalogSuggestions} from './pages/search-catalog.js';
import {initializeVault, vault} from './pages/vault.js';
import {label, initializeLabel} from './pages/label.js';
import {loginPage, initializeLogin} from './pages/login.js';
import {verify} from './pages/verify.js';
import {initializeCertificateViewer} from './components/certificate-viewer.js';
import {initializeCertificateActions} from './components/certificate-actions.js';
import {importPage} from './pages/import.js';
import {getCards, getCertificate} from './store/cards.js';
import {locationsRequest} from './store/locations.js';
import {addVaultImages} from './store/vault-images.js';
import {escapeHTML} from './utils/format.js';
import {certificateFromPath, normalizeCert} from './utils/cert.js';
import {pageSkeleton} from './components/page-skeleton.js';

let renderVersion = 0;
const privatePaths = new Set(['/archive', '/vault', '/label', '/import', '/profile', '/billing', '/gemini-usage']);

function footer() {
  return `<footer class="site-footer no-print"><span>© ${new Date().getFullYear()} DCR Card Vault</span><span>Certificate details are public. Your vault details remain private.</span></footer>`;
}

function failurePage(error) {
  return `<main class="app-page"><section class="surface-card"><h1>We couldn’t load your collection.</h1><p class="page-description">${escapeHTML(error.message || 'Please try again in a moment.')}</p><button class="btn btn-primary" type="button" onclick="location.reload()">Try again</button></section></main>`;
}

function requireLogin(route) {
  location.href = `/login?next=${encodeURIComponent(route)}`;
}

function showPageLoading(app, path, isCertificate) {
  const privacy = path === '/privacy' || path === '/privacy/';
  const loadingHeader = `<header class="site-header" aria-hidden="true"><div class="header-inner wrap"><span class="logo-wrap"><img class="logo" src="/assets/logo/dcr-mark.svg" alt=""><span>Distinguished Card Registry</span></span><div class="sk-header-nav"><span class="skeleton sk-nav-item sk-nav-home"></span><span class="skeleton sk-nav-item sk-nav-add"></span><span class="skeleton sk-nav-item sk-nav-vault"></span><span class="skeleton sk-nav-item sk-nav-labels"></span><span class="skeleton sk-nav-account"></span></div><span class="skeleton sk-menu-toggle"></span></div></header>`;
  app.innerHTML = (privacy ? '' : loadingHeader) + pageSkeleton(path, isCertificate, isCertificate) + (privacy ? '' : footer());
}

export async function render() {
  destroyCatalogSuggestions();
  const version = ++renderVersion;
  const route = location.pathname + location.search;
  const path = location.pathname;
  const isCertificate = certificateFromPath(path) !== null;
  const app = document.getElementById('app');
  if (path !== '/login') showPageLoading(app, path, isCertificate);
  if (path === '/privacy' || path === '/privacy/') {
    const {privacyPage} = await import('./pages/privacy.js');
    if (version !== renderVersion || location.pathname + location.search !== route) return;
    app.innerHTML = privacyPage();
    document.title = 'Privacy Policy — DCR Card Vault';
    return;
  }
  if (path === '/login') {
    app.innerHTML = loginPage();
    await initializeLogin();
    return;
  }

  let user = null;
  try { user = await getCurrentUser(); } catch {}
  if (version !== renderVersion || location.pathname + location.search !== route) return;
  if (privatePaths.has(path) && !user) { requireLogin(route); return; }

  let content = home();
  let failed = false;
  try {
    if (path === '/gemini-usage') content = geminiUsage();
    else if (path === '/billing') content = billing();
    else if (path === '/profile') content = profile(user, await getCards());
    else if (path === '/archive') content = search();
    else if (path === '/import') content = importPage(user);
    else if (path === '/verify' || isCertificate) content = await certificatePage();
    else if (['/vault', '/label'].includes(path)) content = await privatePage(path);
  } catch (error) { content = failurePage(error); failed = true; }
  if (version !== renderVersion || location.pathname + location.search !== route) return;
  app.innerHTML = header(path, user) + content + footer();
  bindHeader();
  if (failed) return;
  if (path === '/gemini-usage') initializeGeminiUsage();
  if (path === '/profile') initializeProfile(user);
  if (path === '/archive') initializeSearchPage();
  if (path === '/vault') initializeVault();
  if (path === '/label') initializeLabel();
  if (path === '/verify' || isCertificate) { initializeCertificateViewer(); initializeCertificateActions(); }
  window.scrollTo(0, 0);
}

async function privatePage(path) {
  const cards = await getCards();
  if (path === '/vault') return vault(await addVaultImages(cards), (await locationsRequest()).locations);
  if (path === '/label') return label(cards);
}

async function certificatePage() {
  const cert = normalizeCert(certificateFromPath(location.pathname));
  const card = cert ? await getCertificate(cert) : null;
  return verify(card ? await addVaultImages([card]) : []);
}
