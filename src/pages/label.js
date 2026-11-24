import {showToast, dismissToast} from '../components/toast.js';
import {sheetPreviewSkeleton} from '../components/page-skeleton.js';
import {sheetPreviewMarkup, initializeSheetPreview} from '../components/sheet-preview.js';
import {heartCheckbox} from '../components/heart-checkbox.js';
import {compareVaultCards, vaultSortSelect} from '../utils/vault-sort.js';
import {getCertificate} from '../store/cards.js';
import {vaultImage} from '../components/card-item.js';
import {escapeHTML as esc} from '../utils/format.js';
import {normalizeCert} from '../utils/cert.js';
import {parseCertRanges} from '../utils/cert-ranges.js';
import {enrichLabelCard} from '../utils/label-card.js';
import * as api from '../utils/label-renderer.js';

let entries = [];
let vaultCards = [];
let busy = false;
const page = () => document.querySelector('.label-page');
const ready = () => entries.filter(entry => !entry.error);
const cardPhoto = card => vaultImage({...card, referenceImage: card.frontImage || card.referenceImage, frontImage: card.referenceImage}, 'label-image-empty', 'No photo');

export async function label(cards = []) {
  vaultCards = cards;
  const cert = normalizeCert(new URLSearchParams(location.search).get('cert'));
  if (cert && !entries.some(entry => entry.cert === cert)) {
    const card = cards.find(item => normalizeCert(item.certNumber) === cert);
    if (card) await addCards([card]);
  }
  return `<main class="app-page label-page">
    <header class="page-heading"><h1>Labels</h1><p class="page-description">Add certificates, review your labels, and download your sheets.</p></header>
    <div class="label-workspace">
    <section class="surface-card label-add"><h2>Add certificates</h2>
      <label class="form-field" for="label-cert-input"><span>Certificate numbers</span><textarea class="form-control" id="label-cert-input" rows="2" placeholder="1-10, 12-18, 25"></textarea></label>
      <p class="muted">Enter individual numbers or ranges separated by commas. Up to 500 numbers per search.</p>
      <div class="label-controls"><button class="btn btn-primary" data-label-action="search">Find and add</button><button class="btn btn-ghost" data-label-action="vault">Choose from Vault</button></div>
    </section>
    <section class="surface-card label-list-section"><div class="label-list-heading"><div><h2>Print queue</h2><p class="muted" id="label-count"></p></div><button class="label-clear" type="button" data-label-action="clear" aria-label="Clear all labels" title="Clear all labels"><svg class="label-clear-lid" viewBox="0 0 24 6" aria-hidden="true"><path d="M4 5h16M9 5V2h6v3"/></svg><svg class="label-clear-bin" viewBox="0 0 24 20" aria-hidden="true"><path d="M5 1l1 16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-16M10 5v10M14 5v10"/></svg></button></div>
      <div id="label-list"></div><div class="label-bottom"><p class="label-print-note">Print at actual size, double-sided, flip on long edge. Each sheet contains up to 40 labels.</p><div class="label-controls"><button class="btn btn-ghost" data-label-action="preview">Preview sheets</button><button class="btn btn-primary" data-label-action="download">Download PDF</button></div></div>
    </section>
    </div>
    <dialog class="label-dialog" id="label-dialog"><div id="label-dialog-content"></div></dialog>
  </main>`;
}

export function initializeLabel() { refresh(); }

async function addCards(cards) {
  let added = 0;
  let duplicate = 0;
  for (const card of cards) {
    const cert = normalizeCert(card.certNumber);
    if (!cert || entries.some(entry => entry.cert === cert)) { duplicate++; continue; }
    let data = {};
    let error = '';
    try {
      if (String(card.game).toLowerCase() !== 'pokemon') throw new Error('Only Pokémon labels are supported.');
      data = api.cardLabelData(await enrichLabelCard(card));
      data.certNumber = cert;
      error = api.validateLabelData(data)[0] || '';
      const pair = error ? {} : await api.renderLabelSvgPair(data);
      entries.push({cert, name: card.name, year: card.year, frontImage: card.frontImage, referenceImage: card.referenceImage, data, error, ...pair});
    } catch (cause) {
      entries.push({cert, name: card.name, year: card.year, frontImage: card.frontImage, referenceImage: card.referenceImage, data, error: cause.message || 'Could not prepare this label.'});
    }
    added++;
  }
  return {added, duplicate};
}

function refresh() {
  if (!page()) return;
  const valid = ready().length;
  document.getElementById('label-count').textContent = `${valid} ready · ${Math.ceil(valid / 40)} sheets${entries.length - valid ? ` · ${entries.length - valid} need attention` : ''}`;
  const list = document.getElementById('label-list');
  list.innerHTML = entries.length ? `<div class="label-rows">${entries.map((item, i) => `<div class="label-row"><span class="label-row-number">${i + 1}</span><div class="label-row-info"><strong>${esc(item.name || 'Certificate')}</strong><span>Cert ${esc(item.cert)}</span>${item.error ? `<small>${esc(item.error)}</small>` : ''}</div><div class="label-row-actions"><span class="label-card-image">${cardPhoto(item)}</span><button class="btn btn-ghost" data-label-action="view" data-cert="${item.cert}">View</button><button class="label-remove" data-label-action="remove" data-cert="${item.cert}" aria-label="Remove ${item.cert}">×</button></div></div>`).join('')}</div>` : '<p class="label-empty">No labels in your queue yet.<br>Add cards to get started.</p>';
  for (const action of ['preview', 'download']) page().querySelector(`[data-label-action="${action}"]`).disabled = !valid || busy;
  page().querySelector('[data-label-action="clear"]').disabled = !entries.length || busy;
  for (const action of ['search', 'vault']) page().querySelector(`[data-label-action="${action}"]`).disabled = busy;
}

function status(text, type = 'success', pending = false) { showToast(text, type, {key: 'label-operation', pending}); }
function dialog(html) { document.getElementById('label-dialog-content').innerHTML = html; document.getElementById('label-dialog').showModal(); }
function closeDialog() { document.getElementById('label-dialog').close(); }
function dialogHead(title) { return `<div class="label-dialog-head"><h2>${title}</h2><button class="dialog-close location-close" type="button" aria-label="Close" title="Close" data-label-action="close">×</button></div>`; }

async function searchCerts() {
  let certs;
  try { certs = parseCertRanges(document.getElementById('label-cert-input').value); }
  catch (error) { status(error.message, 'warning'); return; }
  busy = true; refresh(); status(`Searching ${certs.length} certificates…`, 'warning', true);
  const results = new Array(certs.length);
  let next = 0;
  const worker = async () => { while (next < certs.length) { const i = next++; try { results[i] = {card: await getCertificate(certs[i])}; } catch { results[i] = {failed: true}; } } };
  await Promise.all(Array.from({length: Math.min(8, certs.length)}, worker));
  if (!page()) { busy = false; dismissToast('label-operation'); return; }
  const missing = certs.filter((_, i) => !results[i].card && !results[i].failed);
  const failed = certs.filter((_, i) => results[i].failed);
  const result = await addCards(results.map(item => item.card).filter(Boolean));
  busy = false; refresh();
  const summary = `Added ${result.added} · Not found ${missing.length} · Already added ${result.duplicate} · Search failed ${failed.length}`;
  const details = [missing.length ? `Not found: ${missing.join(', ')}` : '', failed.length ? `Search failed; retry: ${failed.join(', ')}` : ''].filter(Boolean).join(' · ');
  status([summary, details].filter(Boolean).join(' · '), missing.length || failed.length ? 'warning' : 'success');
}


function chooseVault() {
  const cards = vaultCards.filter(card => String(card.game).toLowerCase() === 'pokemon').sort((a, b) => compareVaultCards(a, b, 'date-desc'));
  dialog(`${dialogHead('Choose from Vault', true)}<p class="muted label-dialog-description">Select the cards to add to your sheets.</p><div class="label-vault-toolbar"><label class="label-select-all">${heartCheckbox(`data-label-select-all ${cards.some(card => !entries.some(item => item.cert === normalizeCert(card.certNumber))) ? '' : 'disabled'}`)} Select all</label>${vaultSortSelect('label-vault-sort')}</div><div class="label-vault-list">${cards.map(card => `<label>${heartCheckbox(`value="${esc(normalizeCert(card.certNumber))}" ${entries.some(item => item.cert === normalizeCert(card.certNumber)) ? 'disabled' : ''}`)}<span><strong>${esc(card.name)}</strong><small>Cert ${esc(normalizeCert(card.certNumber))}</small></span><span class="label-card-image">${cardPhoto(card)}</span></label>`).join('') || '<p>No Pokémon cards in your vault.</p>'}</div><div class="label-controls label-vault-actions"><button class="btn btn-primary" data-label-action="add-vault">Add selected</button></div>`);
}

function viewLabel(cert) {
  const item = entries.find(entry => entry.cert === cert);
  if (!item) return;
  const fields = [['Year', item.data.year], ['Card type', item.data.cardType], ['Series', item.data.series], ['Name', item.data.name],
    ['Set', item.data.setName], ['Card number', item.data.cardNumber], ['Rarity', item.data.rarity],
    ['Condition', item.data.condition]];
  dialog(`${dialogHead(`Cert ${esc(cert)}`)}<div class="label-edit-grid">${fields.map(([name, value]) => `<div class="form-field"><span>${name}</span><div class="form-control">${esc(value || '—')}</div></div>`).join('')}</div><p class="label-status">${esc(item.error || '')}</p><div class="label-edit-preview">${item.frontSvg || ''}${item.backSvg || ''}</div>`);
}

async function previewSheets() {
  const labels = ready();
  dialog(`${dialogHead('Sheet preview')}${sheetPreviewSkeleton(Math.ceil(labels.length / 40) * 2)}`);
  try {
    const sheets = [];
    for (let i = 0; i < labels.length; i += 40) {
      const sides = [];
      for (const side of ['front', 'back']) {
        const svg = await api.renderSheetSvg(labels.slice(i, i + 40), side);
        sides.push(`<figure class="sheet-page"><figcaption>Sheet ${Math.floor(i / 40) + 1} · ${side}</figcaption><img class="sheet-page-image" alt="Sheet ${Math.floor(i / 40) + 1} ${side}" src="${esc(api.labelSvgDataUri(svg))}"></figure>`);
      }
      sheets.push(`<div class="sheet-preview-pair">${sides.join('')}</div>`);
    }
    if (document.getElementById('label-dialog')?.open) {
      const content = document.getElementById('label-dialog-content');
      content.innerHTML = `${dialogHead('Sheet preview')}${sheetPreviewMarkup(sheets)}`;
      initializeSheetPreview(content);
    }
  } catch (error) { status(error.message || 'Could not preview sheets.', 'error'); closeDialog(); }
}

async function download() {
  busy = true; refresh(); status('Preparing PDF…', 'warning', true);
  try { const {downloadLabelPdf} = await import('../utils/label-pdf.js'); await downloadLabelPdf(ready(), api); status('PDF downloaded.'); }
  catch (error) { status(error.message || 'Could not create PDF.', 'error'); }
  finally { busy = false; refresh(); }
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-label-action]');
  if (!button || !page()) return;
  const action = button.dataset.labelAction;
  if (action === 'search' && !busy) await searchCerts();
  if (action === 'vault' && !busy) chooseVault();
  if (action === 'close') closeDialog();
  if (action === 'add-vault') {
    const selected = new Set([...document.querySelectorAll('.label-vault-list input:checked')].map(input => input.value));
    closeDialog(); busy = true; refresh(); status('Preparing labels…', 'warning', true);
    const result = await addCards(vaultCards.filter(card => selected.has(normalizeCert(card.certNumber))));
    busy = false; refresh(); status(`Added ${result.added} labels.`);
  }
  if (action === 'remove') { entries = entries.filter(item => item.cert !== button.dataset.cert); refresh(); }
  if (action === 'clear' && !busy && entries.length) {
    button.classList.add('is-clearing');
    setTimeout(() => button.classList.remove('is-clearing'), 600);
    entries = []; refresh(); status('Labels cleared.');
  }
  if (action === 'view') viewLabel(button.dataset.cert);
  if (action === 'preview') await previewSheets();
  if (action === 'download' && !busy) await download();
});

function updateVaultSelection() {
  const all = document.querySelector('[data-label-select-all]');
  if (!all) return;
  const boxes = [...document.querySelectorAll('.label-vault-list input:not(:disabled)')];
  const checked = boxes.filter(box => box.checked).length;
  all.checked = boxes.length > 0 && checked === boxes.length;
  all.indeterminate = checked > 0 && checked < boxes.length;
}

document.addEventListener('change', event => {
  if (!page()) return;
  if (event.target.matches('#label-vault-sort')) {
    const list = document.querySelector('.label-vault-list');
    const cards = new Map(vaultCards.map(card => [normalizeCert(card.certNumber), card]));
    [...list.querySelectorAll('label')].sort((a, b) => compareVaultCards(cards.get(a.querySelector('input').value), cards.get(b.querySelector('input').value), event.target.value)).forEach(row => list.append(row));
  }
  if (event.target.matches('[data-label-select-all]')) {
    document.querySelectorAll('.label-vault-list input:not(:disabled)').forEach(box => { box.checked = event.target.checked; });
  }
  if (event.target.matches('[data-label-select-all], .label-vault-list input')) updateVaultSelection();
});
