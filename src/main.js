// DCR Card Vault - Entry - English only
import {render} from './router.js';
import {legacyRoute} from './utils/routes.js';
import {initializeBackToTop} from './components/back-to-top.js';
const oldRoute = legacyRoute(location.hash);
if (oldRoute) history.replaceState(null, '', oldRoute);
render();
initializeBackToTop();
