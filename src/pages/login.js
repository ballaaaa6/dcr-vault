import {login} from '../auth.js';
export function loginPage(){
  return `<main class="wrap" style="max-width:420px;padding:40px 20px 80px"><div class="card" style="padding:24px;text-align:center"><img src="public/assets/logo/dcr-logo.png" style="height:54px"><h1>Login</h1><p class="muted">Temporary: admin / admin1234</p><input id="u" placeholder="Username - admin" style="width:100%;padding:12px;border-radius:999px;border:1px solid var(--dcr-border);margin:6px 0"><input id="p" type="password" placeholder="Password - admin1234" style="width:100%;padding:12px;border-radius:999px;border:1px solid var(--dcr-border);margin:6px 0"><button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="window.__doLogin()">Login</button><p id="login-err" style="color:var(--dcr-red);display:none">Wrong username or password</p></div></main>`;
}
window.__doLogin=()=>{
  const u=document.getElementById('u').value.trim();
  const p=document.getElementById('p').value.trim();
  import('../auth.js').then(m=>{ if(m.login(u,p)){ location.hash='#/'; } else { document.getElementById('login-err').style.display='block'; } });
};
