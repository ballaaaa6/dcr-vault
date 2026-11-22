// DCR Card Vault - Entry - English only
import {render} from './router.js';
import {legacyRoute} from './utils/routes.js';
const oldRoute = legacyRoute(location.hash);
if (oldRoute) history.replaceState(null, '', oldRoute);
render();
// 3D tilt for cards
document.addEventListener('mousemove', (e)=>{
  const card=e.target.closest && e.target.closest('.tilt');
  if(!card) return;
  const r=card.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width-0.5;
  const y=(e.clientY-r.top)/r.height-0.5;
  card.style.transform=`translateY(-6px) rotateY(${x*8}deg) rotateX(${-y*8}deg)`;
});
document.addEventListener('mouseout', (e)=>{
  const card=e.target.closest && e.target.closest('.tilt');
  if(card) card.style.transform='';
});
