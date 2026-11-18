// TEMP AUTH - admin / admin1234 - Change before production. Do NOT commit real secrets.
const KEY='dcr-session';
export function login(user, pass){
  if(user==='admin' && pass==='admin1234'){
    const s={user, exp: Date.now()+24*3600*1000};
    sessionStorage.setItem(KEY, JSON.stringify(s));
    return true;
  }
  return false;
}
export function isLoggedIn(){
  try{ const s=JSON.parse(sessionStorage.getItem(KEY)||'null'); return s && s.exp>Date.now(); }catch{ return false; }
}
export function logout(){ sessionStorage.removeItem(KEY); location.hash='#/login'; }
export function requireAuth(){ if(!isLoggedIn()){ location.hash='#/login'; return false; } return true; }
