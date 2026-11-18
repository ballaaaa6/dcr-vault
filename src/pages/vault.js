import {getCards, updateCard} from '../store/cards.js';
import {listRow} from '../components/card-item.js';
import {isLoggedIn} from '../auth.js';
export function vault(){
  if(!isLoggedIn()){ location.hash='#/login'; return '<p>Redirect to login...</p>'; }
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const focusId=params.get('id');
  const cards=getCards();
  const focus=cards.find(c=>c.id===focusId)||cards[0];
  return `<main class="wrap" style="padding:20px 20px 90px"><h1>My Vault</h1><p class="muted">${cards.length} cards • Prices visible only here, never on label.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><input id="vault-q" placeholder="Search name / cert / set" style="flex:1;padding:10px;border-radius:999px;border:1px solid var(--dcr-border)"><select id="vault-status" style="padding:10px;border-radius:999px"><option value="">All Status</option><option>in-vault</option><option>for-sale</option><option>sold</option><option>grading</option></select><button class="btn btn-primary" onclick="window.__filterVault()">Filter</button></div><div style="display:grid;grid-template-columns:1fr 340px;gap:16px" class="vault-grid"><div id="vault-list" style="display:flex;flex-direction:column;gap:10px">${cards.map(listRow).join('')}</div><aside class="card" style="padding:16px;height:fit-content"><h3>${focus?focus.name:'No card'}</h3><div class="muted">${focus?focus.setName+' • '+focus.year+' • '+focus.cardNumber:''}</div><div style="margin:10px 0"><span class="badge">${focus?focus.gradeLabel:''}</span> <span class="muted">Cert: ${focus?focus.certNumber:''}</span></div><label>Buy Price (THB)<input id="d-buy" value="${focus?focus.buyPrice||'':''}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--dcr-border)"></label><div style="height:8px"></div><label>Sell Price (THB)<input id="d-sell" value="${focus?focus.sellPrice||'':''}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--dcr-border)"></label><div style="height:8px"></div><label>Status<select id="d-status" style="width:100%;padding:10px;border-radius:10px"><option ${focus&&focus.status==='in-vault'?'selected':''}>in-vault</option><option ${focus&&focus.status==='for-sale'?'selected':''}>for-sale</option><option ${focus&&focus.status==='sold'?'selected':''}>sold</option><option ${focus&&focus.status==='grading'?'selected':''}>grading</option></select></label><div style="height:8px"></div><label>Bought From<input id="d-from" value="${focus?focus.boughtFrom||'':''}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--dcr-border)"></label><div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-primary" onclick="window.__saveDetail('${focus?focus.id:''}')">Save</button><a class="btn btn-ghost" href="#/label?cert=${focus?focus.certNumber:''}">Print Label</a></div><p class="muted" style="font-size:12px">Buy/Sell price is Vault only. Never printed on label.</p></aside></div></main>`;
}
window.__filterVault=()=>{
  const q=(document.getElementById('vault-q').value||'').toLowerCase();
  const st=document.getElementById('vault-status').value;
  const {getCards}=window.__vaultDeps||{};
};
window.__saveDetail=(id)=>{
  const {updateCard}=window.__vaultDeps||{};
  // fallback direct
  import('../store/cards.js').then(m=>{
    m.updateCard(id,{buyPrice:document.getElementById('d-buy').value,sellPrice:document.getElementById('d-sell').value,status:document.getElementById('d-status').value,boughtFrom:document.getElementById('d-from').value});
    alert('Saved'); location.reload();
  });
};
