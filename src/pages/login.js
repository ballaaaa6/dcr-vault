import {nextRoute} from '../utils/routes.js';
import {getGoogleConfig, signInWithGoogle} from '../auth.js';
import {hasImportDecision, loadLegacyCards} from '../store/db.js';

export function loginPage() {
  return `
    <main class="auth-page">
      <div class="auth-art" aria-hidden="true"><div class="auth-branch"></div><div class="auth-petals">${Array.from({length: 22}, () => '<i></i>').join('')}</div></div>
      <section class="auth-showcase" aria-labelledby="auth-brand-title">
        <div class="auth-showcase-top"><span>A SPACE FOR COLLECTORS</span><span>YOUR COLLECTION</span></div>
      </section>
      <section class="auth-panel" aria-labelledby="login-title">
        <div class="auth-panel-top"><span>YOUR PERSONAL VAULT</span><a href="/">Explore DCR Vault <span aria-hidden="true">↗</span></a></div>
        <div class="auth-form-wrap">
          <div class="auth-panel-kicker">WELCOME TO YOUR VAULT</div>
          <h2 id="login-title">Your collection awaits.</h2>
          <p class="auth-intro">Sign in with Google to organize your cards and pick up where you left off.</p>
          <div id="google-signin" class="google-signin"></div>
          <p id="login-status" class="auth-status" role="status" aria-live="polite">Loading secure sign-in…</p>
          <div class="auth-divider"><span>YOUR ACCOUNT</span></div>
          <div class="auth-benefit"><span class="auth-benefit-icon" aria-hidden="true">✓</span><p><strong>New to DCR Vault?</strong><br>Your account is created automatically the first time you sign in.</p></div>
          <div class="auth-benefit"><span class="auth-benefit-icon" aria-hidden="true">⌑</span><p><strong>Your vault, your account</strong><br>Your vault details stay private; certificate details and card photos are public.</p></div>
          <p class="auth-privacy">We use your Google name, email, and profile photo for your account. DCR Vault does not access your Gmail inbox. <a href="/privacy/">Read the privacy policy.</a></p>
        </div>
        <div class="auth-panel-foot"><span>© ${new Date().getFullYear()} DCR CARD VAULT</span><a href="/">BACK TO HOME</a></div>
      </section>
    </main>`;
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
    const target = nextRoute(location.search);
    if (loadLegacyCards().length && !hasImportDecision(user.id)) {
      location.href = `/import?next=${encodeURIComponent(target)}`;
      return;
    }
    location.href = target;
  } catch (error) {
    status.textContent = error.message || 'Sign-in failed. Please try again.';
    status.classList.add('auth-status-error');
  }
}

window.__googleCredential = response => handleCredential(response);
