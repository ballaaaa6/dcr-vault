import {startCardScan} from '../components/card-scan.js';
import {identifyCardImage} from '../store/cards.js';
import {escapeHTML} from '../utils/format.js';

let version = 0;
let busy = false;
let identified = false;
let applied = {};
let provenance = {};
let reading = {};
let requestId = '';

export function intakeClassification() {
  return {category: reading.category || '', colorElements: reading.colorElements || [], subtypeDetail: reading.subtypeDetail || '',
    releaseYear: reading.releaseYear || '', yearSource: provenance.year === 'user' ? 'user' : reading.yearSource || '', inferredFields: reading.inferredFields || []};
}
export function identificationProvenance() { return {identificationStatus: identified ? 'unresolved' : 'unknown', fieldProvenance: {...provenance}}; }
export function clearAppliedReading() { reading = {}; applied = {}; provenance = {}; requestId = ''; identified = false; }
export function resetCardIdentificationState() { version += 1; identified = false; closeResult(); }
export function identificationDialogMarkup() {
  return `<dialog id="identification-result" class="identification-dialog" aria-labelledby="identification-title"><header class="identification-dialog-header"><div><h2 id="identification-title">Review card reading</h2><p>Review and edit the details read from the photo.</p></div><button class="dialog-close" type="button" data-close-identification aria-label="Close">×</button></header><div id="identification-dialog-content" class="identification-dialog-content"></div></dialog>`;
}
function closeResult() {
  const dialog = document.getElementById('identification-result');
  if (dialog?.open) dialog.close();
  const info = document.getElementById('identification-info');
  if (info) info.hidden = true;
}
function updateButton() {
  const button = document.getElementById('identify-card');
  const file = document.getElementById('m-image-front')?.files?.[0];
  if (!button) return;
  button.disabled = busy || !file;
  if (!busy) button.querySelector('span').textContent = identified && file ? 'Identify again' : 'Identify card';
}
function detailMarkup() {
  const fields = [['category', 'Category', reading.category], ['colorElements', 'Colors / elements', (reading.colorElements || []).join(', ')], ['subtypeDetail', 'Subtype', reading.subtypeDetail]];
  const rows = fields.map(([key, label, value]) => `<label class="identification-read-field"><b>${label}</b><input class="form-control" data-reading-field="${key}" value="${escapeHTML(value || '')}" maxlength="120"></label>`).join('');
  const inferred = (reading.inferredFields || []).join(', ');
  return `<section class="identification-read-summary"><p>Review the values and edit them if needed.</p>${inferred ? `<p>Inferred from model knowledge: ${escapeHTML(inferred)}</p>` : ''}<div class="identification-read-grid">${rows}</div></section>`;
}
function applyReading(fields, id) {
  const previous = reading;
  reading = {...fields, colorElements: [...(fields.colorElements || [])], inferredFields: [...(fields.inferredFields || [])]};
  for (const key of ['category', 'colorElements', 'subtypeDetail']) if (provenance[key] === 'user') reading[key] = previous[key];
  reading.inferredFields = reading.inferredFields.filter(key => provenance[key === 'set' ? 'setName' : key] !== 'user');
  const selectedGame = document.getElementById('m-game').value;
  if (provenance.game === 'user' && selectedGame && selectedGame !== fields.game) {
    reading.category = ''; reading.colorElements = []; reading.subtypeDetail = '';
  }
  requestId = id || '';
  window.__intakeIdentification = {...fields, sourceLanguage: fields.language};
  window.__intakeCatalogCard = null;
  const values = {game: fields.game, language: fields.language, sourceLanguage: fields.language,
    name: fields.name, setName: fields.setName, year: fields.year,
    cardNumber: fields.cardNumber, rarity: fields.rarity, cardTypeLabel: fields.game,
    languageLabel: ''};
  applied = {};
  for (const [key, value] of Object.entries(values)) {
    const input = document.getElementById(`m-${key}`);
    if ((key === 'sourceLanguage' || key === 'languageLabel') && provenance.language === 'user') continue;
    if (key === 'cardTypeLabel' && provenance.game === 'user') continue;
    if (!input || provenance[key] === 'user') continue;
    input.value = value || '';
    applied[key] = input.value;
    provenance[key] = input.value ? 'gemini' : 'unknown';
  }
  const fieldStates = Object.fromEntries(['year', 'setName'].map(key => [key,
    provenance[key] === 'user' ? 'user_preserved' : values[key] ? 'applied' : 'empty_reading']));
  const displayed = Object.fromEntries(['name', 'setName', 'year', 'cardNumber', 'rarity'].map(key =>
    [key, document.getElementById(`m-${key}`)?.value || '']));
  logIdentificationStage('browser', {yearSource: provenance.year === 'user' ? 'user' : fields.yearSource,
    setValueSource: provenance.setName === 'user' ? 'user' : fields.setName ? 'gemini' : '',
    values: displayed, fieldStates, provenance});
  window.dispatchEvent(new Event('intake-values-updated'));
  const panel = document.getElementById('identification-dialog-content');
  panel.innerHTML = detailMarkup();
  document.getElementById('identification-info').hidden = false;
  const status = document.getElementById('manual-status');
  status.dataset.state = 'success';
  status.textContent = 'Card reading complete. Review the details before saving.';
}
export function logIdentificationStage(stage, details) {
  if (!requestId) return;
  fetch('/api/cards/identification-log', {method: 'POST', credentials: 'same-origin', keepalive: true,
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestId, stage, ...details})}).catch(() => {});
}
async function analyzeFront() {
  const file = document.getElementById('m-image-front')?.files?.[0];
  const button = document.getElementById('identify-card');
  if (!file || !button || busy) return;
  const current = ++version;
  busy = true; identified = true; button.disabled = true;
  button.querySelector('span').textContent = 'Analyzing…';
  const stop = startCardScan();
  const status = document.getElementById('manual-status');
  status.dataset.state = 'pending'; status.textContent = 'Reading card…';
  try {
    const result = await identifyCardImage(file);
    if (current !== version) return;
    if (!result.fields || !result.readingAdequate) throw new Error('Could not read enough details. Try a clearer photo.');
    applyReading(result.fields, result.requestId);
  } catch (error) {
    if (current === version) { status.dataset.state = 'error'; status.textContent = error.message || 'Card reading failed. Try again.'; }
  } finally {
    stop(); busy = false; updateButton();
    if (current !== version && status.dataset.state === 'pending') {
      status.dataset.state = 'warning'; status.textContent = 'The photo changed. Review the details before saving.';
    }
  }
}
function invalidatePhoto() {
  version += 1; identified = false; closeResult();
  for (const [key, value] of Object.entries(applied)) {
    const input = document.getElementById(`m-${key}`);
    if (input && input.value === value) input.value = '';
  }
  reading = {}; applied = {}; requestId = '';
  for (const key of ['category', 'colorElements', 'subtypeDetail']) delete provenance[key];
  window.__intakeIdentification = null;
  window.dispatchEvent(new Event('intake-values-updated'));
  updateButton();
}
document.addEventListener('input', event => {
  const detail = event.target.dataset?.readingField;
  if (detail) {
    reading[detail] = detail === 'colorElements' ? event.target.value.split(',').map(item => item.trim()).filter(Boolean) : event.target.value;
    provenance[detail] = 'user';
    return;
  }
  const key = event.target.id?.replace(/^m-/, '');
  if (!['game', 'language', 'name', 'setName', 'year', 'cardNumber', 'rarity'].includes(key)) return;
  provenance[key] = 'user'; delete applied[key];
  if (key === 'game' && reading.game && event.target.value !== reading.game) {
    reading.category = ''; reading.colorElements = []; reading.subtypeDetail = '';
    for (const field of ['category', 'colorElements', 'subtypeDetail']) delete provenance[field];
    const panel = document.getElementById('identification-dialog-content');
    if (panel && identified) panel.innerHTML = detailMarkup();
  }
  const inferred = key === 'setName' ? 'set' : key;
  reading.inferredFields = (reading.inferredFields || []).filter(field => field !== inferred);
});
document.addEventListener('change', event => { if (event.target.matches('[data-upload-side="front"]')) invalidatePhoto(); });
window.addEventListener('intake-front-image-cleared', invalidatePhoto);
document.addEventListener('click', event => {
  if (event.target.closest('#identify-card')) analyzeFront();
  if (event.target.closest('#identification-info')) document.getElementById('identification-result')?.showModal();
  if (event.target.closest('[data-close-identification]')) document.getElementById('identification-result')?.close();
  if (event.target.id === 'identification-result') event.target.close();
});
