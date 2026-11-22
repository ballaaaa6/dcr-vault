import {nextRoute} from '../utils/routes.js';
import {getGoogleConfig, signInWithGoogle} from '../auth.js';
import {hasImportDecision, loadLegacyCards} from '../store/db.js';

export function loginPage() {
  return `
    <main class="auth-page">
      <div class="auth-art" aria-hidden="true"><div class="auth-branch"></div><div class="auth-petals">${Array.from({length: 22}, () => '<i></i>').join('')}</div></div>
      <div class="auth-showcase" aria-hidden="true"></div>
      <section class="auth-panel" aria-labelledby="login-title">
        <div class="auth-form-wrap">
          <h2 id="login-title">Sign in to DCR Vault</h2>
          <p class="auth-intro">Access and organize your card collection.</p>
          <div id="google-signin" class="google-signin"></div>
          <p id="login-status" class="auth-status" role="status" aria-live="polite">Loading secure sign-in…</p>
          <p class="auth-account-note">New account? It will be created automatically when you sign in.</p>
          <p class="auth-privacy"><a href="/privacy/">Privacy Policy</a></p>
        </div>
      </section>
      <footer class="site-footer auth-footer"><span>© ${new Date().getFullYear()} DCR Card Vault</span><a href="/">Back to Home</a></footer>
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
    window.google.accounts.id.renderButton(host, {theme: 'outline', size: 'large', shape: 'rectangular', width: Math.min(400, host.clientWidth), text: 'continue_with', logo_alignment: 'left'});
    status.textContent = '';
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
