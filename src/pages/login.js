import {login} from '../auth.js';
export function loginPage(){
  return `
    <main class="auth-page">
      <section class="auth-card" aria-labelledby="login-title">
        <img class="auth-logo" src="/assets/logo/dcr-mark.svg" alt="DCR">
        <div class="page-eyebrow">YOUR COLLECTION</div>
        <h1 id="login-title">Sign in to your vault</h1>
        <p class="muted">Manage your saved cards and collection details.</p>
        <label class="form-field"><span>Username</span><input class="form-control" id="u" autocomplete="username" placeholder="Username"></label>
        <label class="form-field"><span>Password</span><input class="form-control" id="p" type="password" autocomplete="current-password" placeholder="Password"></label>
        <button class="btn btn-primary auth-submit" type="button" onclick="window.__doLogin()">Login</button>
        <p class="auth-demo-note">Demo login: admin / admin1234</p>
        <p id="login-err" class="login-error" role="alert" hidden>Wrong username or password.</p>
      </section>
    </main>`;
}
window.__doLogin=()=>{
  const u=document.getElementById('u').value.trim();
  const p=document.getElementById('p').value.trim();
  if(login(u,p)){ location.hash='#/'; } else { document.getElementById('login-err').hidden=false; }
};
