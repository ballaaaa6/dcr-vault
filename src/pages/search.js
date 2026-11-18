import {addCard} from '../store/cards.js';
export function search(){
  return `
    <main class="app-page">
      <header class="page-heading">
        <div class="page-eyebrow">COLLECTION INTAKE</div>
        <h1>Add a card to your vault</h1>
        <p class="page-description">Scan a card or enter its details to add it to your collection.</p>
      </header>
      <div class="intake-grid">
        <section class="surface-card intake-card" aria-labelledby="scan-title">
          <div class="section-heading"><span class="section-number">01</span><div><h2 id="scan-title">Scan a card</h2><p>Upload clear images of both sides.</p></div></div>
          <div class="upload-grid">
            <label class="upload-field"><span>Front image</span><input type="file" id="f-front" accept="image/*"></label>
            <label class="upload-field"><span>Back image</span><input type="file" id="f-back" accept="image/*"></label>
          </div>
          <div class="panel-actions">
            <button class="btn btn-primary" type="button" onclick="window.__scan()">Scan Card</button>
            <a class="btn btn-ghost" href="#/">Cancel</a>
          </div>
          <div id="scan-result" class="scan-result" aria-live="polite"></div>
        </section>
        <section class="surface-card intake-card" aria-labelledby="manual-title">
          <div class="section-heading"><span class="section-number">02</span><div><h2 id="manual-title">Manual entry</h2><p>Add the card details directly.</p></div></div>
          <div class="field-grid">
            <label class="form-field"><span>Name</span><input class="form-control" id="m-name" placeholder="e.g. Charizard"></label>
            <label class="form-field"><span>Set</span><input class="form-control" id="m-set" placeholder="e.g. Base Set"></label>
            <label class="form-field"><span>Year</span><input class="form-control" id="m-year" placeholder="e.g. 1999"></label>
            <label class="form-field"><span>Card number</span><input class="form-control" id="m-num" placeholder="e.g. #4"></label>
          </div>
          <button class="btn btn-primary manual-submit" type="button" onclick="window.__manual()">Add to Vault</button>
        </section>
      </div>
    </main>`;
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
