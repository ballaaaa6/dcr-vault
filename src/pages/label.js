import {findByCert} from '../store/cards.js';
import {findCatalogCandidates, findCatalogCardById} from '../store/catalog.js';
import {escapeHTML} from '../utils/format.js';
import {normalizeCert} from '../utils/cert.js';

const RARITY_OPTIONS = ['C', 'UC', 'R', 'P', 'DR', 'UR', 'IR', 'SIR', 'HR', 'S', 'SAR'];
let printSheet = [];
let renderer;
let previewVersion = 0;
let sheetVersion = 0;

async function labelRenderer() {
  renderer ||= await import('../utils/label-renderer.js');
  return renderer;
}

function inputField(id, label, value, attrs = '') {
  return `<label class="form-field"><span>${label}</span><input class="form-control" id="${id}" data-label-field="${id}" value="${escapeHTML(value)}" ${attrs}></label>`;
}

function selectOptions(options, selected, placeholder) {
  const empty = `<option value=""${selected ? '' : ' selected'}>${placeholder}</option>`;
  return empty + options.map(value => `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`).join('');
}

function labelForm(data, conditionOptions) {
  return `
    ${inputField('yearSeries', 'Year / series', data.yearSeries, 'autocomplete="off"')}
    ${inputField('name', 'Name', data.name, 'autocomplete="off"')}
    ${inputField('setName', 'Set', data.setName, 'autocomplete="off"')}
    ${inputField('cardNumber', 'Card number', data.cardNumber, 'autocomplete="off"')}
    <label class="form-field"><span>Condition</span><select class="form-control" id="condition" data-label-field="condition">${selectOptions(conditionOptions, data.condition, 'Choose condition')}</select></label>
    <label class="form-field"><span>Rarity code</span><select class="form-control" id="rarity" data-label-field="rarity">${selectOptions(RARITY_OPTIONS, data.rarity, 'Choose rarity')}</select></label>
    ${inputField('certNumber', 'Cert number', data.certNumber, 'inputmode="numeric" maxlength="8" pattern="[0-9]{1,8}" placeholder="1 to 8 digits" autocomplete="off"')}`;
}

function previewMarkup(svg, side) {
  if (!svg) return `<div class="label-preview-placeholder">Complete the fields to see the label.</div>`;
  return `<div class="label-preview-svg" role="img" aria-label="${side} label preview">${svg}</div>`;
}

function sheetPage(title, side, svg, dataUri) {
  return `<figure class="sheet-page"><figcaption>${title}</figcaption><img class="sheet-page-image" data-sheet-preview="${side}" alt="${title}" src="${escapeHTML(dataUri(svg))}"></figure>`;
}

function printOutput(front, back, dataUri) {
  return `<div class="print-sheet-output" aria-hidden="true"><section class="print-sheet-page"><img data-print-page="front" alt="A4 front label sheet" src="${escapeHTML(dataUri(front))}"></section><section class="print-sheet-page"><img data-print-page="back" alt="A4 back label sheet" src="${escapeHTML(dataUri(back))}"></section></div>`;
}

function emptyLabelPage(message) {
  return `<main class="app-page"><section class="surface-card empty-state"><h1>${message}</h1><p>Choose a saved Pokémon card from your vault first.</p><a class="btn btn-primary" href="#/vault">Open My Vault</a></section></main>`;
}

function numberKey(value) {
  return String(value || '').trim().replace(/^#/, '').split('/')[0].replace(/^0+(?=\d)/, '').toLowerCase();
}

async function enrichFromExactCatalogMatch(card) {
  if (card.catalogCardId) {
    const match = await findCatalogCardById(card.catalogCardId);
    return match ? {...card, name: match.name, setName: match.setName, year: match.year,
      cardNumber: match.cardNumber, setId: match.setId, seriesId: match.seriesId, seriesName: match.seriesName} : card;
  }
  if (!card.name || !card.setName || !card.year || !card.cardNumber) return card;
  const matches = await findCatalogCandidates({name: card.name, setName: card.setName, year: card.year, cardNumber: card.cardNumber});
  const exact = matches.filter(match => match.name.toLowerCase() === card.name.toLowerCase()
    && match.setName.toLowerCase() === card.setName.toLowerCase() && match.year === card.year
    && numberKey(match.cardNumber) === numberKey(card.cardNumber));
  if (exact.length !== 1) return card;
  const match = exact[0];
  return {...card, catalogCardId: match.id, sourceLanguage: card.sourceLanguage || 'en',
    sourceSetId: card.sourceSetId || match.setId, setId: match.setId, seriesId: match.seriesId, seriesName: match.seriesName};
}

export async function label(cards = []) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const cert = params.get('cert');
  const card = cert ? findByCert(cards, cert) : cards[0];
  if (!card) return emptyLabelPage('Card not found in your vault');
  if (String(card.game).toLowerCase() !== 'pokemon') return emptyLabelPage('This label template supports Pokémon cards only');

  const api = await labelRenderer();
  const labelCard = await enrichFromExactCatalogMatch(card);
  const data = api.cardLabelData(labelCard);
  const errors = api.validateLabelData(data);
  const pair = errors.length ? null : await api.renderLabelSvgPair(data);
  const [frontSheet, backSheet] = await Promise.all([
    api.renderSheetSvg(printSheet, 'front'), api.renderSheetSvg(printSheet, 'back')
  ]);
  return `
    <main class="app-page label-page" data-card-id="${escapeHTML(card.id || card.certNumber)}" data-label-metadata-ready="${data.labelMetadataReady}">
      <header class="page-heading">
        <div class="page-eyebrow">PRINT WORKSPACE</div>
        <h1>Label settings</h1>
        <p class="page-description">Edit printed details, review both sides, then add the 70 × 20 mm label to an A4 sheet.</p>
      </header>
      <div class="label-layout">
        <section class="surface-card label-editor" aria-labelledby="label-editor-title">
          <div class="section-heading"><span class="section-number">01</span><div><h2 id="label-editor-title">Certificate details</h2><p>Printed information only.</p></div></div>
          <div class="label-fields">${labelForm(data, api.CONDITION_OPTIONS)}</div>
          <button class="btn btn-primary" type="button" data-label-action="add" ${errors.length ? 'disabled' : ''}>Add to Print Sheet</button>
          <p id="label-status" class="label-status" role="status" aria-live="polite">${errors.length ? escapeHTML(errors[0]) : 'Preview reflects the values above.'}</p>
        </section>
        <section class="label-previews" aria-label="Label previews">
          <div class="surface-card preview-card"><h2>Front preview <span>70 × 20 mm</span></h2><div class="label-preview-frame" data-label-preview="front">${previewMarkup(pair?.frontSvg, 'Front')}</div></div>
          <div class="surface-card preview-card"><h2>Back preview <span>70 × 20 mm</span></h2><div class="label-preview-frame" data-label-preview="back">${previewMarkup(pair?.backSvg, 'Back')}</div></div>
          <div class="label-print-actions">
            <p id="sheet-count" class="muted">Sheet: ${printSheet.length} / 40 labels selected</p>
            <button class="btn btn-primary" type="button" data-label-action="print" ${printSheet.length ? '' : 'disabled'}>Print A4 · ${printSheet.length} labels</button>
            <button class="btn btn-ghost" type="button" data-label-action="pdf" ${printSheet.length ? '' : 'disabled'}>Save as PDF</button>
          </div>
        </section>
      </div>
      <section class="label-sheet-preview surface-card no-print">
        <div class="section-heading"><span class="section-number">02</span><div><h2>A4 sheet preview</h2><p>10 columns × 4 rows · 40 positions · duplex long-edge</p></div></div>
        <div class="sheet-preview-pages">${sheetPage('Front · page 1', 'front', frontSheet, api.labelSvgDataUri)}${sheetPage('Back · page 2', 'back', backSheet, api.labelSvgDataUri)}</div>
        <p class="label-print-note">Print at Actual Size with long-edge duplex. Codes use DCR-TEST values and do not verify a registry record.</p>
        <button class="btn btn-ghost" type="button" data-label-action="clear" ${printSheet.length ? '' : 'disabled'}>Clear print sheet</button>
      </section>
    </main>
    ${printOutput(frontSheet, backSheet, api.labelSvgDataUri)}`;
}

function currentDraft() {
  const draft = Object.fromEntries([...document.querySelectorAll('[data-label-field]')].map(input => [input.dataset.labelField, input.value]));
  draft.labelMetadataReady = document.querySelector('.label-page')?.dataset.labelMetadataReady !== 'false';
  draft.certNumber = normalizeCert(draft.certNumber) || draft.certNumber;
  return draft;
}

function showPreview(side, svg) {
  const frame = document.querySelector(`[data-label-preview="${side}"]`);
  frame.innerHTML = previewMarkup(svg, side === 'front' ? 'Front' : 'Back');
}

async function updateDraftPreview() {
  const version = ++previewVersion;
  const api = await labelRenderer();
  const page = document.querySelector('.label-page');
  const cardId = page?.dataset.cardId;
  if (!cardId) return;
  const data = currentDraft();
  const errors = api.validateLabelData(data);
  const status = document.getElementById('label-status');
  const addButton = document.querySelector('[data-label-action="add"]');
  addButton.disabled = errors.length > 0;
  if (errors.length) {
    showPreview('front', null);
    showPreview('back', null);
    status.textContent = errors[0];
    return;
  }
  try {
    const pair = await api.renderLabelSvgPair(data);
    if (version !== previewVersion || document.querySelector('.label-page')?.dataset.cardId !== cardId) return;
    showPreview('front', pair.frontSvg);
    showPreview('back', pair.backSvg);
    status.textContent = 'Preview updated. Add or update this card on the print sheet before printing.';
  } catch (error) {
    if (version !== previewVersion || document.querySelector('.label-page')?.dataset.cardId !== cardId) return;
    showPreview('front', null);
    showPreview('back', null);
    status.textContent = error.message || 'The label preview could not be rendered.';
    addButton.disabled = true;
  }
}

async function refreshSheet() {
  const version = ++sheetVersion;
  const api = await labelRenderer();
  const [front, back] = await Promise.all([
    api.renderSheetSvg(printSheet, 'front'), api.renderSheetSvg(printSheet, 'back')
  ]);
  if (version !== sheetVersion || !document.querySelector('.label-page')) return;
  document.querySelectorAll('[data-sheet-preview="front"], [data-print-page="front"]').forEach(image => { image.src = api.labelSvgDataUri(front); });
  document.querySelectorAll('[data-sheet-preview="back"], [data-print-page="back"]').forEach(image => { image.src = api.labelSvgDataUri(back); });
  const count = document.getElementById('sheet-count');
  if (count) count.textContent = `Sheet: ${printSheet.length} / 40 labels selected`;
  const print = document.querySelector('[data-label-action="print"]');
  const pdf = document.querySelector('[data-label-action="pdf"]');
  if (print) { print.disabled = printSheet.length === 0; print.textContent = `Print A4 · ${printSheet.length} labels`; }
  if (pdf) pdf.disabled = printSheet.length === 0;
  const currentId = document.querySelector('.label-page')?.dataset.cardId;
  const add = document.querySelector('[data-label-action="add"]');
  if (add && currentId && printSheet.some(item => item.cardId === currentId)) add.textContent = 'Update Label on Sheet';
  else if (add) add.textContent = 'Add to Print Sheet';
}

async function addCurrentLabel() {
  const page = document.querySelector('.label-page');
  const cardId = page?.dataset.cardId;
  if (!cardId) return;
  const data = currentDraft();
  const status = document.getElementById('label-status');
  const api = await labelRenderer();
  if (document.querySelector('.label-page')?.dataset.cardId !== cardId) return;
  const errors = api.validateLabelData(data);
  if (errors.length) { status.textContent = errors[0]; return; }
  const pair = await api.renderLabelSvgPair(data);
  if (document.querySelector('.label-page')?.dataset.cardId !== cardId) return;
  const existing = printSheet.findIndex(item => item.cardId === cardId);
  if (printSheet.some((item, index) => index !== existing && item.data.certNumber === data.certNumber)) {
    status.textContent = 'This Cert number is already assigned to another label on this sheet.';
    return;
  }
  if (existing < 0 && printSheet.length >= 40) { status.textContent = 'The A4 sheet already contains 40 labels.'; return; }
  const entry = {cardId, data, ...pair};
  if (existing >= 0) printSheet[existing] = entry;
  else printSheet.push(entry);
  await refreshSheet();
  status.textContent = existing >= 0 ? 'Label updated on the print sheet.' : 'Label added to the print sheet.';
}

async function openPrintDialog() {
  if (!printSheet.length) return;
  await refreshSheet();
  if (!document.querySelector('.label-page')) return;
  document.body.classList.add('label-print-mode');
  await Promise.all([...document.querySelectorAll('[data-print-page]')].map(image =>
    image.decode ? image.decode().catch(() => {}) : Promise.resolve()
  ));
  window.print();
}

document.addEventListener('input', event => {
  if (event.target.matches('[data-label-field]')) updateDraftPreview();
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-label-field]')) updateDraftPreview();
});
document.addEventListener('focusout', event => {
  if (event.target.dataset.labelField !== 'certNumber') return;
  event.target.value = normalizeCert(event.target.value) || event.target.value;
  updateDraftPreview();
});
document.addEventListener('click', event => {
  const action = event.target.closest('[data-label-action]')?.dataset.labelAction;
  if (action === 'add') addCurrentLabel();
  if (action === 'clear') { printSheet = []; refreshSheet(); document.getElementById('label-status').textContent = 'Print sheet cleared.'; }
  if (action === 'print' || action === 'pdf') openPrintDialog();
});
window.addEventListener('afterprint', () => document.body.classList.remove('label-print-mode'));
