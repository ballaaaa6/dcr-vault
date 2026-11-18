import {getGoogleConfig, signInWithGoogle} from '../auth.js';
import {hasImportDecision, loadLegacyCards} from '../store/db.js';

export function loginPage() {
  return `
    <main class="auth-page">
      <section class="auth-showcase" aria-labelledby="auth-brand-title">
        <a class="auth-brand" href="#/" aria-label="DCR Card Vault home">
          <img src="/assets/logo/dcr-mark.svg" alt=""><span>DCR CARD VAULT</span>
        </a>
        <div class="auth-showcase-copy">
          <div class="auth-eyebrow"><span></span>COLLECT WITH CONFIDENCE</div>
          <h1 id="auth-brand-title">Every card.<br><span>One trusted vault.</span></h1>
          <p>Keep your DCR certified collection organized, private, and ready whenever you need it.</p>
        </div>
        <div class="auth-visual" aria-hidden="true">
          <div class="auth-ring auth-ring-one"></div><div class="auth-ring auth-ring-two"></div>
          <div class="auth-visual-card auth-visual-back"></div>
          <div class="auth-visual-card auth-visual-front">
            <div class="auth-visual-top"><span>DCR CERTIFIED</span><img src="/assets/logo/dcr-mark.svg" alt=""></div>
            <div class="auth-visual-mark"><img src="/assets/logo/dcr-shield.png" alt=""></div>
            <div class="auth-visual-bottom"><span>YOUR COLLECTION</span><strong>CARD VAULT</strong></div>
          </div>
        </div>
        <div class="auth-showcase-foot"><span>BUILT FOR YOUR COLLECTION</span><span>01 — 03</span></div>
      </section>
      <section class="auth-panel" aria-labelledby="login-title">
        <div class="auth-panel-top"><span>ALREADY COLLECTING?</span><a href="#/">Explore DCR Vault <span aria-hidden="true">↗</span></a></div>
        <div class="auth-form-wrap">
          <img class="auth-mobile-logo" src="/assets/logo/dcr-mark.svg" alt="DCR Card Vault">
          <div class="auth-panel-kicker">WELCOME TO DCR</div>
          <h2 id="login-title">Sign in to your vault</h2>
          <p class="auth-intro">Use your Google account to access your private collection.</p>
          <div id="google-signin" class="google-signin"></div>
          <p id="login-status" class="auth-status" role="status" aria-live="polite">Loading secure sign-in…</p>
          <div class="auth-divider"><span>YOUR ACCOUNT</span></div>
          <div class="auth-benefit"><span class="auth-benefit-icon" aria-hidden="true">✓</span><p><strong>New to DCR Vault?</strong><br>Your account is created automatically the first time you sign in.</p></div>
          <div class="auth-benefit"><span class="auth-benefit-icon" aria-hidden="true">⌑</span><p><strong>Private by default</strong><br>Only your account can access its saved card records.</p></div>
          <p class="auth-privacy">We use your Google name, email, and profile photo for your account. DCR Vault does not access your Gmail inbox. <a href="/privacy/">Read the privacy policy.</a></p>
        </div>
        <div class="auth-panel-foot"><span>© ${new Date().getFullYear()} DCR CARD VAULT</span><a href="#/">BACK TO HOME</a></div>
      </section>
    </main>`;
}

function nextRoute() {
  const value = new URLSearchParams(location.hash.split('?')[1] || '').get('next') || '';
  return value.startsWith('#/') && !value.startsWith('#/login') && !value.startsWith('#/import') ? value : '#/vault';
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

export async function initializeLogin() {
  const status = document.getElementById('login-status');
  try {
    const config = await getGoogleConfig();
    if (!config.clientId) throw new Error('Google sign-in is not configured for this site yet.');
    await loadGoogleScript();
    window.google.accounts.id.initialize({client_id: config.clientId, nonce: config.nonce, callback: window.__googleCredential});
    const host = document.getElementById('google-signin');
    window.google.accounts.id.renderButton(host, {theme: 'outline', size: 'large', shape: 'rectangular', width: Math.min(360, host.clientWidth), text: 'continue_with', logo_alignment: 'left'});
    status.textContent = 'Continue with Google. New accounts are welcome.';
  } catch (error) {
    status.textContent = error.message || 'Secure sign-in is temporarily unavailable.';
    status.classList.add('auth-status-error');
  }
}

async function handleCredential(response) {
  const status = document.getElementById('login-status');
  status.textContent = 'Signing you in securely…';
  status.classList.remove('auth-status-error');
  try {
    const {user} = await signInWithGoogle(response.credential);
    const target = nextRoute();
    if (loadLegacyCards().length && !hasImportDecision(user.id)) {
      location.hash = `#/import?next=${encodeURIComponent(target)}`;
      return;
    }
    location.hash = target;
  } catch (error) {
    status.textContent = error.message || 'Sign-in failed. Please try again.';
    status.classList.add('auth-status-error');
  }
}

window.__googleCredential = response => handleCredential(response);
