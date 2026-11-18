import {addCard} from '../store/cards.js';
export function search(){
  return `<main class="wrap" style="padding:20px 20px 80px"><h1>Search Cards</h1><p class="muted">Upload front + back. AI assists only. If confidence &lt; 85%, you must review.</p><div class="card" style="padding:16px"><label>Front Image <input type="file" id="f-front" accept="image/*"></label><div style="height:10px"></div><label>Back Image <input type="file" id="f-back" accept="image/*"></label><div style="display:flex;gap:10px;margin-top:14px"><button class="btn btn-primary" onclick="window.__scan()">Scan Card</button><button class="btn btn-ghost" onclick="location.hash='#/'">Cancel</button></div><div id="scan-result" style="margin-top:16px"></div></div><div class="card" style="padding:16px;margin-top:16px"><b>Manual Entry</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><input id="m-name" placeholder="Name e.g. Charizard"><input id="m-set" placeholder="Set e.g. Base Set"><input id="m-year" placeholder="Year e.g. 1999"><input id="m-num" placeholder="Card Number e.g. #4"></div><button class="btn btn-primary" style="margin-top:12px" onclick="window.__manual()">Add to Vault</button></div></main>`;
}
window.__scan = ()=>{
  const el=document.getElementById('scan-result');
  el.innerHTML=`<div class="skeleton"></div><p>Analyzing... Pokeum > pHash > OCR</p>`;
  setTimeout(()=>{ el.innerHTML=`<div class="list-row"><div><b>Charizard • Base Set • #4</b><div>Confidence: <b style="color:var(--dcr-red)">92%</b> — Please confirm</div></div><button class="btn btn-primary" onclick="window.__confirmScan()">Confirm & Save</button></div><div class="muted" style="margin-top:8px">2nd candidate: Blastoise #9 — 61% | 3rd: Venusaur #15 — 44%</div>`; },900);
};
window.__confirmScan = ()=>{
  addCard({id:'dcr-'+Date.now(),game:'pokemon',name:'Charizard',setName:'Base Set',year:'1999',cardNumber:'#4',rarity:'R',gradeLabel:'GEM MT 10',certNumber:String(Math.floor(10000000+Math.random()*89999999)),status:'in-vault',buyPrice:'',sellPrice:'',buyDate:'',soldDate:'',boughtFrom:'',soldTo:'',notes:'Scanned'});
  alert('Saved to Vault'); location.hash='#/vault';
};
window.__manual = ()=>{
  const name=document.getElementById('m-name').value||'New Card';
  const set=document.getElementById('m-set').value||'Base Set';
  addCard({id:'dcr-'+Date.now(),game:'pokemon',name,setName:set,year:document.getElementById('m-year').value||'1999',cardNumber:document.getElementById('m-num').value||'#1',rarity:'R',gradeLabel:'RAW',certNumber:String(Math.floor(10000000+Math.random()*89999999)),status:'in-vault',buyPrice:'',sellPrice:'',buyDate:'',soldDate:'',boughtFrom:'',soldTo:'',notes:'Manual'});
  alert('Saved'); location.hash='#/vault';
};
