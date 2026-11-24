import './styles/action-icons.css';
// DCR Card Vault - Entry - English only
import {render} from './router.js';
import {initializeTooltips} from './components/tooltip.js';
import './styles/tooltip.css';
import {initializeBackToTop} from './components/back-to-top.js';
import {initializeImageLoading} from './components/image-loading.js';
import {initializeTextCursor} from './utils/text-cursor.js';
import './styles/image-loading.css';
initializeTooltips();
initializeImageLoading();
initializeTextCursor();
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
render();
initializeBackToTop();
