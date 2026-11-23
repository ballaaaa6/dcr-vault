import {escapeHTML as esc} from '../utils/format.js';

// options is an array of [value, label] pairs; changes bubble from the select.
export function dropdown({id, label, options, value, align = 'start', required = false}) {
  const selected = options.find(([option]) => option === value) || options[0];
  if (!selected) throw new Error('Dropdown requires at least one option.');
  const selectOptions = options.map(([option, text]) => `<option value="${esc(option)}"${option === selected[0] ? ' selected' : ''}>${esc(text)}</option>`).join('');
  const items = options.filter(([option]) => option !== '' || !required).map(([option, text]) => `<button type="button" role="menuitemradio" aria-checked="${option === selected[0]}" data-dropdown-value="${esc(option)}"><span>${esc(text)}</span><span class="dropdown-check" aria-hidden="true">✓</span></button>`).join('');
  return `<div class="dropdown"><select id="${esc(id)}" class="sr-only" tabindex="-1" aria-hidden="true"${required ? ' required' : ''}>${selectOptions}</select><details class="dropdown-control" data-dropdown-align="${align === 'end' ? 'end' : 'start'}"><summary id="${esc(id)}-trigger" data-empty="${!selected[0]}" aria-label="${esc(label)}: ${esc(selected[1])}" data-dropdown-label="${esc(label)}"><span data-dropdown-current>${esc(selected[1])}</span><svg class="dropdown-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg></summary><div class="dropdown-menu" role="menu" aria-label="${esc(label)}">${items}</div></details></div>`;
}

document.addEventListener('click', event => {
  const item = event.target.closest('[data-dropdown-value]');
  document.querySelectorAll('.dropdown-control[open]').forEach(menu => {
    if (!menu.contains(event.target)) menu.open = false;
  });
  if (!item) return;
  const menu = item.closest('.dropdown-control');
  const select = menu.parentElement.querySelector('select');
  select.value = item.dataset.dropdownValue;
  menu.querySelectorAll('[data-dropdown-value]').forEach(option => option.setAttribute('aria-checked', String(option === item)));
  const text = item.querySelector('span').textContent;
  const summary = menu.querySelector('summary');
  menu.querySelector('[data-dropdown-current]').textContent = text;
  summary.dataset.empty = String(!select.value);
  summary.setAttribute('aria-label', `${summary.dataset.dropdownLabel}: ${text}`);
  menu.open = false;
  summary.focus();
  select.dispatchEvent(new Event('change', {bubbles: true}));
});

document.addEventListener('keydown', event => {
  const menu = event.target.closest('.dropdown-control');
  if (!menu || !menu.open) return;
  if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); event.preventDefault(); }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = [...menu.querySelectorAll('[data-dropdown-value]')];
  const index = items.indexOf(document.activeElement);
  const next = event.key === 'Home' || (index < 0 && event.key === 'ArrowDown') ? 0 : event.key === 'End' || index < 0 ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next].focus();
  event.preventDefault();
});
