import {header, bindHeader} from './components/header.js';
import {home} from './pages/home.js';
import {search} from './pages/search.js';
import {vault} from './pages/vault.js';
import {label} from './pages/label.js';
import {loginPage} from './pages/login.js';
import {verify} from './pages/verify.js';
export function render(){
  const hash=location.hash||'#/';
  const path=hash.split('?')[0];
  let html='';
  if(path==='#/login') html=loginPage();
  else if(path==='#/search') html=search();
  else if(path==='#/vault') html=vault();
  else if(path==='#/label') html=label();
  else if(path==='#/verify') html=verify();
  else html=home();
  document.getElementById('app').innerHTML = header(path) + html + `<footer class="site-footer no-print"><span>© ${new Date().getFullYear()} DCR Card Vault</span><span>Card records stay in this browser.</span></footer>`;
  bindHeader();
  window.scrollTo(0,0);
}
window.addEventListener('hashchange', render);
