import {escapeHTML} from '../utils/format.js';
import {datePicker, initializeDatePicker} from '../components/date-picker.js';

export function geminiUsage() {
  return `<main class="app-page"><header class="page-heading"><h1>Gemini usage</h1><p class="page-description">Attempts and tokens recorded by this site since tracking began. Dates use UTC.</p></header><section class="surface-card"><form id="usage-filter">${datePicker('', {name: 'from', label: 'From', id: 'usage-from'})}${datePicker('', {name: 'to', label: 'To', id: 'usage-to'})} <button class="btn btn-primary">Show usage</button></form><div id="usage-results" role="status">Loading usage…</div></section></main>`;
}

export function initializeGeminiUsage() {
  const form = document.querySelector('#usage-filter');
  const target = document.querySelector('#usage-results');
  form.querySelectorAll('[data-date-picker]').forEach(picker => initializeDatePicker(picker.parentElement));
  async function load(event) {
    event?.preventDefault();
    target.textContent = 'Loading usage…';
    const query = new URLSearchParams([...new FormData(form)].filter(([, value]) => value));
    try {
      const response = await fetch(`/api/gemini-usage?${query}`);
      if (!response.ok) throw new Error(response.status === 403 ? 'This page is available to the administrator only.' : 'Could not load usage.');
      const {rows} = await response.json();
      target.innerHTML = rows.length ? rows.map(row => `<article class="list-row"><div><h2>Key ${Number(row.slot)} · ${escapeHTML(row.keyId)}</h2><p>${escapeHTML(row.model)} · ${row.attempts} attempts · ${row.successes} successful · ${row.failures} failed</p><p>Input: ${number(row.promptTokens)} · Output: ${number(row.outputTokens)} · Total: ${number(row.totalTokens)} tokens</p><p>${row.missingUsage} attempts without total token data</p></div></article>`).join('') : '<p>No recorded usage in this period.</p>';
    } catch (error) { target.textContent = error.message; }
  }
  form.addEventListener('submit', load);
  load();
}

function number(value) { return value == null ? 'Unavailable' : Number(value).toLocaleString(); }
