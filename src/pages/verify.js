import {findByCert} from '../store/cards.js';
export function verify(){
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const cert=params.get('cert')||'';
  const card=cert?findByCert(cert):null;
  return `<main class="wrap" style="max-width:640px;padding:30px 20px 80px;text-align:center"><h1>Verify a Cert</h1><p class="muted">Public page - no login needed. Shows only name, set, grade, cert. No price.</p><form class="search-bar" onsubmit="event.preventDefault(); location.hash='#/verify?cert='+encodeURIComponent(this.querySelector('input').value)"><input placeholder="Enter cert e.g. 01234567" value="${cert}"><button>Verify</button></form>${cert? (card? `<div class="card" style="padding:20px;margin-top:20px"><span class="badge">Verified Authentic</span><h2>${card.name}</h2><p>${card.setName} • ${card.year} • ${card.cardNumber} • ${card.rarity}</p><p><b>${card.gradeLabel}</b> • Cert: ${card.certNumber}</p><img src="public/assets/logo/dcr-logo.png" style="height:36px;margin-top:10px"></div>` : `<div class="card" style="padding:20px;margin-top:20px"><b>Not Found</b><p class="muted">Cert ${cert} not found. Check number and try again.</p></div>` ) : ''}</main>`;
}
