import {initializeCornerCloseAnimation} from './components/corner-close.js';
import {initializeActionIcons} from './components/action-icons.js';
import './styles/action-icons.css';
import './styles/corner-images.css';
// DCR Card Vault - Entry - English only
import {render} from './router.js';
import './styles/tooltip.css';
import {initializeBackToTop} from './components/back-to-top.js';
import {initializeImageLoading} from './components/image-loading.js';
import {initializeTextCursor} from './utils/text-cursor.js';
import './styles/image-loading.css';
initializeCornerCloseAnimation();
initializeActionIcons();
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
window.addEventListener('popstate', render);
render();
initializeBackToTop();
