import {identifyCardImage} from '../store/cards.js';
import {findImageCandidates} from '../store/catalog.js';
import {escapeHTML} from '../utils/format.js';
import {hideAllCatalogSuggestions} from './search-catalog.js';

const FIELDS = [['name', 'Name'], ['setName', 'Set'], ['year', 'Year'], ['cardNumber', 'Card number'],
  ['language', 'Language'], ['rarity', 'Rarity']];
let candidateCards = [];
let extractedFields = {};
let analysisVersion = 0;
let analysisBusy = false;

function updateButton() {
  const button = document.getElementById('identify-card');
  const file = document.getElementById('m-image-front')?.files?.[0];
  if (button) button.disabled = analysisBusy || !file;
}

function clearResult() {
  candidateCards = [];
  extractedFields = {};
  const panel = document.getElementById('identification-result');
  if (panel) { panel.innerHTML = ''; panel.hidden = true; }
}

export function resetCardIdentificationState() {
  analysisVersion += 1;
  clearResult();
}

function readingMarkup(fields) {
  return FIELDS.map(([key, label]) => `<span class="identification-value"><strong>${label}:</strong> ${escapeHTML(fields[key] || 'Not read')}</span>`).join('');
}

function candidateMarkup(card, index) {
  const details = [card.setName, card.year, card.cardNumber, card.rarity, card.language?.toUpperCase()].filter(Boolean);
  return `<button class="catalog-option" data-image-candidate="${index}" type="button"><strong>${escapeHTML(card.name)}</strong><span>${escapeHTML(details.join(' · '))}</span></button>`;
}

function showCandidates(fields, cards) {
  candidateCards = cards;
  extractedFields = fields;
  const panel = document.getElementById('identification-result');
  if (!panel) return;
  const options = cards.length ? cards.map(candidateMarkup).join('') : '<p class="catalog-empty">No close catalog match. Review the reading and enter the details manually.</p>';
  panel.innerHTML = `<strong>Gemma 4 reading · review before saving</strong><div class="identification-values">${readingMarkup(fields)}</div>
    <p class="identification-match-note">Choose the catalog record that matches this card. This only fills the form; it does not save the card.</p>
    <div class="identification-options">${options}</div>`;
  panel.hidden = false;
}

function chooseCandidate(index) {
  const card = candidateCards[index];
  if (!card) return;
  document.getElementById('m-name').value = card.name;
  document.getElementById('m-setName').value = card.setName;
  document.getElementById('m-year').value = card.year;
  const observedNumber = String(extractedFields.cardNumber || '').trim();
  const localNumber = value => value.replace(/^#/, '').split('/')[0].replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
  document.getElementById('m-cardNumber').value = observedNumber && localNumber(observedNumber) === localNumber(card.cardNumber)
    ? observedNumber : card.cardNumber;
  document.getElementById('m-rarity').value = card.rarity;
  window.__intakeCatalogGame = 'pokemon';
  hideAllCatalogSuggestions();
  const rarityNote = card.rarity ? '' : ' The catalog has no rarity for this card; verify it manually.';
  document.getElementById('manual-status').textContent = `Catalog candidate selected. Check the details, then enter Cert and Grade.${rarityNote}`;
  document.getElementById('m-grade').focus();
}

function showError(message) {
  const panel = document.getElementById('identification-result');
  if (!panel) return;
  panel.innerHTML = `<p class="catalog-empty">${escapeHTML(message)}</p>`;
  panel.hidden = false;
}

async function analyzeFront() {
  const button = document.getElementById('identify-card');
  const file = document.getElementById('m-image-front')?.files?.[0];
  if (!button || !file) return;
  const version = ++analysisVersion;
  analysisBusy = true;
  button.disabled = true;
  button.textContent = 'Reading with Gemma 4…';
  const panel = document.getElementById('identification-result');
  panel.innerHTML = '<p class="catalog-empty">Reading the front image and comparing it with the card catalog…</p>';
  panel.hidden = false;
  try {
    const result = await identifyCardImage(file);
    const candidates = await findImageCandidates(result.fields);
    if (version === analysisVersion) showCandidates(result.fields, candidates);
  } catch (error) {
    if (version === analysisVersion) showError(error.message || 'Card image analysis is unavailable.');
  } finally {
    analysisBusy = false;
    button.textContent = 'Read front with Gemma 4';
    updateButton();
  }
}

document.addEventListener('change', event => {
  if (!event.target.matches('[data-upload-side="front"]')) return;
  analysisVersion += 1;
  clearResult();
  updateButton();
});

window.addEventListener('intake-front-image-cleared', () => {
  analysisVersion += 1;
  clearResult();
  updateButton();
});

document.addEventListener('click', event => {
  if (event.target.closest('#identify-card')) { analyzeFront(); return; }
  const candidate = event.target.closest('[data-image-candidate]');
  if (candidate) chooseCandidate(Number(candidate.dataset.imageCandidate));
});
