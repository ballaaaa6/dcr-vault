import {header, bindHeader, headerSkeleton} from './components/header.js';
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
import {collectionsRequest} from './store/collections.js';
import {addVaultImages} from './store/vault-images.js';
import {escapeHTML} from './utils/format.js';
import {certificateFromPath, normalizeCert} from './utils/cert.js';
import {pageSkeleton} from './components/page-skeleton.js';
import {cachedPageSkeleton, savePageSkeleton} from './components/skeleton-from-layout.js';
import {collectionsPage, sharedView} from './pages/collections-view.js';
import {initializeCollections} from './pages/collections.js';

let renderVersion = 0;
const privatePaths = new Set(['/archive', '/vault', '/showcase', '/label', '/import', '/profile', '/billing', '/gemini-usage']);

function footer() {
  return `<footer class="site-footer no-print"><span>© ${new Date().getFullYear()} DCR Card Vault</span><span>Certificate details are public. Your vault details remain private.</span></footer>`;
}

function failurePage(error) {
  return `<main class="app-page"><section class="surface-card"><h1>We couldn’t load this page.</h1><p class="page-description">${escapeHTML(error.message || 'Please try again in a moment.')}</p><button class="btn btn-primary" type="button" onclick="location.reload()">Try again</button></section></main>`;
}

function requireLogin(route) {
  location.href = `/login?next=${encodeURIComponent(route)}`;
}

function showPageLoading(app, path, isCertificate) {
  const privacy = path === '/privacy' || path === '/privacy/';
  app.innerHTML = (privacy ? '' : headerSkeleton()) + pageSkeleton(path, isCertificate) + (privacy ? '' : footer());
}

export async function render() {
  destroyCatalogSuggestions();
  const version = ++renderVersion;
  const route = location.pathname + location.search;
  const path = location.pathname;
  const isCertificate = certificateFromPath(path) !== null;
  const sharedToken = /^\/shared-collection\/([a-f0-9]{64})\/?$/.exec(path)?.[1] || /^\/showcase\/[^/]+\/([a-f0-9]{32}|[a-f0-9]{64})\/?$/.exec(path)?.[1];
  const ownerCollection = /^\/showcase\/([^/]+)\/?$/.exec(path)?.[1];
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
  if ((privatePaths.has(path) || ownerCollection) && !user) { requireLogin(route); return; }
  const cached = cachedPageSkeleton(path, user?.id);
  if (cached) app.querySelector('[role="status"] > [aria-hidden="true"]').innerHTML = cached;

  let content = home();
  let failed = false;
  let collectionData;
  try {
    if (sharedToken) {
      const response = await fetch(`/api/shared-collection/${sharedToken}`, {referrerPolicy: 'no-referrer'});
      if (!response.ok) throw new Error('This showcase link is unavailable or sharing has been turned off.');
      content = sharedView((await response.json()).collection);
    }
    else if (path === '/showcase' || ownerCollection) {
      const [groups, cards] = await Promise.all([collectionsRequest(), getCards()]);
      collectionData = [groups.collections, await addVaultImages(cards), ownerCollection];
      content = collectionsPage();
    }
    else if (path === '/gemini-usage') content = geminiUsage();
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
  if (path === '/showcase' || ownerCollection) initializeCollections(...collectionData);
  if (path === '/label') initializeLabel();
  if (path === '/verify' || isCertificate) { initializeCertificateViewer(); initializeCertificateActions(); }
  savePageSkeleton(path, user?.id, app.querySelector('main'));
  window.scrollTo(0, 0);
}

async function privatePage(path) {
  const cards = await getCards();
  if (path === '/vault') {
    const [locations, collections, images] = await Promise.all([locationsRequest(), collectionsRequest(), addVaultImages(cards)]);
    return vault(images, locations.locations, collections.collections);
  }
  if (path === '/label') return label(cards);
}

async function certificatePage() {
  const cert = normalizeCert(certificateFromPath(location.pathname));
  const card = cert ? await getCertificate(cert) : null;
  return verify(card ? await addVaultImages([card]) : []);
}
