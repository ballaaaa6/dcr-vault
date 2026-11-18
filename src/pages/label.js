import {findByCert, getCards} from '../store/cards.js';
import {isLoggedIn} from '../auth.js';
import {escapeHTML} from '../utils/format.js';

function a4Preview(cert) {
  return Array.from({length: 40}, (_, index) => {
    const side = index % 2 === 0 ? 'FRONT' : 'BACK';
    return `<div class="sheet-cell">${side}<span>${cert}</span></div>`;
  }).join('');
}

function safeCardData(card) {
  return {
    ...card,
    name: escapeHTML(card.name),
    setName: escapeHTML(card.setName),
    year: escapeHTML(card.year),
    cardNumber: escapeHTML(card.cardNumber),
    rarity: escapeHTML(card.rarity),
    gradeLabel: escapeHTML(card.gradeLabel),
    certNumber: escapeHTML(card.certNumber)
  };
}

function labelFaces(card) {
  const front = `<div style="border:3px solid var(--dcr-red);background:#fff;font-family:Arial,sans-serif;padding:8px;width:100%;height:100%;box-sizing:border-box"><div style="display:flex;justify-content:space-between"><div><b>${card.year} POKEMON GAME<br>${card.name}<br>${card.setName}</b></div><div style="text-align:right"><b>${card.cardNumber}<br>${card.gradeLabel}<br>${card.rarity}<br>${card.certNumber}</b></div></div><div style="display:flex;justify-content:space-between;align-items:end;margin-top:8px"><span style="font-family:monospace;letter-spacing:2px">|||| |||| ||||</span><img src="/assets/logo/dcr-mark.svg" style="height:22px"></div></div>`;
  const back = `<div style="background:#0A1F6B;color:#fff;font-family:Arial,sans-serif;padding:8px;width:100%;height:100%;box-sizing:border-box;display:flex;justify-content:space-between;align-items:center"><span style="font-weight:900;font-size:22px;opacity:.7">DCR</span><img src="/assets/logo/dcr-shield.png" style="height:44px;background:#ccc;border-radius:6px;padding:2px"><span style="background:#fff;color:#000;padding:6px;font-size:10px">QR ${card.certNumber}</span></div>`;
  return {front, back};
}

export function label() {
  if (!isLoggedIn()) {
    location.hash = '#/login';
    return '<main class="app-page"><p class="muted">Redirecting to login...</p></main>';
  }

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const cert = params.get('cert') || '01234567';
  const card = findByCert(cert) || getCards()[0] || {
    name: 'Charizard', setName: 'Base Set', year: '1999', cardNumber: '#4',
    rarity: 'R', gradeLabel: 'GEM MT 10', certNumber: cert
  };
  const safe = safeCardData(card);
  const {front, back} = labelFaces(safe);
  return `
    <main class="app-page label-page">
      <header class="page-heading">
        <div class="page-eyebrow">PRINT WORKSPACE</div>
        <h1>Label settings</h1>
        <p class="page-description">Edit the certificate details, review both sides, then print the 70 × 20 mm label sheet.</p>
      </header>
      <div class="label-layout">
        <section class="surface-card label-editor" aria-labelledby="label-editor-title">
          <div class="section-heading"><span class="section-number">01</span><div><h2 id="label-editor-title">Certificate details</h2><p>Printed information only.</p></div></div>
          <label class="form-field"><span>Name</span><input class="form-control" id="l-name" value="${safe.name}"></label>
          <label class="form-field"><span>Set</span><input class="form-control" id="l-set" value="${safe.setName}"></label>
          <label class="form-field"><span>Grade</span><input class="form-control" id="l-grade" value="${safe.gradeLabel}"></label>
          <label class="form-field"><span>Cert</span><input class="form-control" id="l-cert" value="${safe.certNumber}"></label>
          <button class="btn btn-primary" type="button" onclick="window.__addToSheet()">Add to Print Sheet</button>
        </section>
        <section class="label-previews" aria-label="Label previews">
          <div class="surface-card preview-card"><h2>Front preview <span>70 × 20 mm</span></h2><div class="label-preview-frame">${front}</div></div>
          <div class="surface-card preview-card"><h2>Back preview <span>70 × 20 mm</span></h2><div class="label-preview-frame">${back}</div></div>
          <div class="label-print-actions">
            <p id="sheet-count" class="muted">Sheet: 1 label selected</p>
            <button class="btn btn-primary" type="button" onclick="window.print()">Print A4 · 40 labels</button>
            <button class="btn btn-ghost" type="button" onclick="alert('PDF download - use Print to PDF')">Download PDF</button>
          </div>
        </section>
      </div>
      <section class="label-sheet-preview no-print">
        <div class="section-heading"><span class="section-number">02</span><div><h2>A4 sheet preview</h2><p>5 columns × 8 rows · 40 label positions</p></div></div>
        <div class="sheet-grid">${a4Preview(safe.certNumber)}</div>
      </section>
    </main>`;
}

window.__addToSheet = () => {
  alert('Added to sheet');
  document.getElementById('sheet-count').textContent = 'Sheet: 2 labels selected';
};
