// DCR Card Vault - Entry - English only
import {render} from './router.js';
import {legacyRoute} from './utils/routes.js';
import {initializeBackToTop} from './components/back-to-top.js';
window.addEventListener('vite:preloadError', event => {
  const key = 'dcr-preload-reload';
  try {
    const lastReload = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - lastReload < 60000) return;
    sessionStorage.setItem(key, String(Date.now()));
    event.preventDefault();
    location.reload();
  } catch {}
});
const oldRoute = legacyRoute(location.hash);
if (oldRoute) history.replaceState(null, '', oldRoute);
render();
initializeBackToTop();
