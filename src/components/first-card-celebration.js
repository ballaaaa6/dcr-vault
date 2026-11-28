import {prepareFireworks} from './fireworks.js';
import '../styles/celebration.css';

export async function celebrateFirstCard(isCurrentPage) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let play;
  try { if (!reduced) play = await prepareFireworks(); }
  catch { return; }
  if (!isCurrentPage()) return;
  let result;
  try {
    const response = await fetch('/api/vault-celebration', {method: 'POST', credentials: 'same-origin'});
    if (!response.ok) return;
    result = await response.json();
  } catch { return; }
  if (!result.celebrate || !isCurrentPage()) return;
  const overlay = document.createElement('div');
  overlay.className = 'celebration-overlay';
  overlay.innerHTML = `<div class="celebration-fireworks" aria-hidden="true"></div>
    <div class="celebration-message" role="status" aria-label="Your first card is in the vault! 🎉">
      <svg viewBox="86 0 856 268" aria-hidden="true" focusable="false">
        <image href="/assets/celebrations/ribbon-banners.png" width="1024" height="1024"/>
        <defs><path id="celebration-text-curve" d="M 229 152 Q 512 53 795 152"/></defs>
        <text><textPath href="#celebration-text-curve" startOffset="50%" text-anchor="middle" textLength="550" lengthAdjust="spacingAndGlyphs">Your first card is in the vault! 🎉</textPath></text>
      </svg>
    </div>`;
  document.body.append(overlay);
  const animation = play?.(overlay.querySelector('.celebration-fireworks'));
  const cleanup = () => { animation?.destroy(); overlay.remove(); };
  setTimeout(cleanup, 4000);
}
