import {nextRoute} from '../utils/routes.js';
import {importCards} from '../store/cards.js';
import {loadLegacyCards, rememberImportDecision} from '../store/db.js';
import {escapeHTML} from '../utils/format.js';



function cardSummary(card, index) {
  const name = escapeHTML(card.name || 'Untitled card');
  const cert = escapeHTML(card.certNumber || 'No Cert number');
  const grade = escapeHTML(card.gradeLabel || 'Grade not set');
  return `<li><label class="import-entry"><input type="checkbox" name="legacy-card" value="${index}" checked><span><strong>${name}</strong><small>Cert ${cert}</small></span><span class="badge">${grade}</span></label></li>`;
}

function importPayload(records) {
  const fields = ['game', 'name', 'setName', 'year', 'yearSeries', 'catalogCardId', 'sourceLanguage', 'sourceSetId',
    'cardNumber', 'rarity', 'gradeLabel', 'certNumber',
    'artist', 'status', 'buyPrice', 'sellPrice', 'buyDate', 'soldDate', 'boughtFrom', 'soldTo', 'notes'];
  return records.map(record => Object.fromEntries(fields.map(field => [field, record[field]])));
}

export function importPage(user) {
  const records = loadLegacyCards();
  window.__importUserId = user.id;
  const preview = records.map(cardSummary).join('');
  return `
    <main class="app-page import-page">
      <header class="page-heading"><div class="page-eyebrow">ONE-TIME DATA IMPORT</div><h1>Move your saved cards?</h1><p class="page-description">This browser has ${records.length} card ${records.length === 1 ? 'record' : 'records'} from the previous local vault.</p></header>
      <section class="surface-card import-card">
        <p>Choose which records to copy into your new account. Review every row and uncheck sample cards from the previous version if they are not yours. Your old browser copy will stay where it is until you clear it.</p>
        <ul class="import-list">${preview || '<li>No card records were found in this browser.</li>'}</ul>
        <div class="import-notice"><strong>What gets copied</strong><span>Card details, Cert numbers, status, prices, notes, and dates. Card photos are not included.</span></div>
        <p class="import-privacy">Certificate details are public. Cert numbers already used by any account are skipped. Other vault details remain private.</p>
        <div class="panel-actions">
          ${records.length ? '<button class="btn btn-primary" type="button" data-import-cards>Import selected records</button>' : ''}
          <button class="btn btn-ghost" type="button" data-skip-import>Keep old copy for now</button>
        </div>
        <p id="import-status" class="import-status" role="status" aria-live="polite"></p>
      </section>
    </main>`;
}

function goToNext() {
  rememberImportDecision(window.__importUserId);
  location.href = nextRoute(location.search);
}

function selectedRecords() {
  const records = loadLegacyCards();
  const selected = [...document.querySelectorAll('[name="legacy-card"]:checked')];
  return selected.map(input => records[Number(input.value)]).filter(Boolean);
}

async function runImport() {
  const button = document.querySelector('[data-import-cards]');
  const status = document.getElementById('import-status');
  const cards = selectedRecords();
  if (!cards.length) {
    status.textContent = 'Select at least one card to import, or keep the local copy for now.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Copying your records securely…';
  try {
    const result = await importCards(importPayload(cards));
    rememberImportDecision(window.__importUserId);
    status.textContent = `Imported ${result.imported}; skipped ${result.skipped}. Your local copy remains in this browser.`;
    location.href = nextRoute(location.search);
  } catch (error) {
    button.disabled = false;
    status.textContent = error.message || 'Import failed. Your local copy has not been changed.';
  }
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-import-cards]')) runImport();
  if (event.target.closest('[data-skip-import]')) goToNext();
});
