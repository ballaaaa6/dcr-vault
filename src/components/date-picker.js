import {escapeHTML} from '../utils/format.js';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = value => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : null;
};
export const displayDate = value => {
  const date = parseDate(value);
  return date ? `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}` : 'Select date';
};

export const calendarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>`;

export function calendarOpensUp(triggerTop, triggerBottom, calendarHeight, viewportHeight) {
  const below = viewportHeight - triggerBottom - 6;
  const above = triggerTop - 6;
  return below < calendarHeight && above > below;
}

export function datePicker(value = '', {name = 'receivedDate', label = 'Date received', id = 'received-date'} = {}) {
  return `<div class="form-field"><span id="${id}-label">${escapeHTML(label)}</span><div class="date-picker" data-date-picker>
    <input type="hidden" name="${escapeHTML(name)}" value="${escapeHTML(value)}">
    <button type="button" class="form-control date-picker-trigger" aria-labelledby="${id}-label ${id}-value" aria-expanded="false" aria-controls="${id}-calendar"><span data-date-value data-empty="${!value}" id="${id}-value">${escapeHTML(displayDate(value))}</span>${calendarIcon}</button>
    <div id="${id}-calendar" class="date-picker-calendar" hidden></div></div></div>`;
}

function renderCalendar(picker, view, level) {
  const selected = picker.querySelector('input').value;
  const now = new Date();
  const today = isoDate(now);
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(view.getFullYear(), view.getMonth(), 1 - first.getDay());
  const days = Array.from({length: 42}, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const value = isoDate(date);
    return `<button type="button" class="date-picker-day${date.getMonth() !== view.getMonth() ? ' is-outside' : ''}${value === selected ? ' is-selected' : ''}" data-date="${value}" aria-label="${displayDate(value)}"${value === selected ? ' aria-current="date"' : ''}${value > today ? ' disabled' : ''}>${date.getDate()}</button>`;
  }).join('');
  const header = `<div class="date-picker-header"><button type="button" class="date-picker-title" data-level="${level === 'day' ? 'year' : 'day'}" aria-label="${level === 'day' ? 'Choose year and month' : 'Return to calendar'}">${months[view.getMonth()]} ${view.getFullYear()} <span aria-hidden="true">▾</span></button><button type="button" data-month="-1" aria-label="Previous month"${view.getFullYear() === 1900 && view.getMonth() === 0 ? ' disabled' : ''}>‹</button><button type="button" data-month="1" aria-label="Next month"${view.getFullYear() === now.getFullYear() && view.getMonth() >= now.getMonth() ? ' disabled' : ''}>›</button></div>`;
  const years = Array.from({length: now.getFullYear() - 1899}, (_, index) => now.getFullYear() - index).map(year => `<button type="button" data-year="${year}" class="${year === view.getFullYear() ? 'is-selected' : ''}">${year}</button>`).join('');
  const monthChoices = months.map((month, index) => `<button type="button" data-choice-month="${index}" class="${index === view.getMonth() ? 'is-selected' : ''}"${view.getFullYear() === now.getFullYear() && index > now.getMonth() ? ' disabled' : ''}>${month.slice(0, 3)}</button>`).join('');
  const content = level === 'year' ? `<div class="date-picker-choices date-picker-years">${years}</div>` : level === 'month' ? `<div class="date-picker-choices">${monthChoices}</div>` : `<div class="date-picker-grid">${weekdays.map(day => `<span>${day}</span>`).join('')}${days}</div>`;
  picker.querySelector('.date-picker-calendar').innerHTML = `${header}${content}<button type="button" class="date-picker-clear" data-clear>Clear date</button>`;
}

export function initializeDatePicker(container) {
  const picker = container.querySelector('[data-date-picker]');
  if (!picker) return;
  const input = picker.querySelector('input');
  const trigger = picker.querySelector('.date-picker-trigger');
  const calendar = picker.querySelector('.date-picker-calendar');
  let view = parseDate(input.value) || new Date();
  let level = 'day';
  let rendering = false;
  const render = () => { rendering = true; renderCalendar(picker, view, level); rendering = false; };
  const close = () => { calendar.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', () => {
    if (!calendar.hidden) return close();
    view = parseDate(input.value) || new Date();
    level = 'day';
    render();
    calendar.classList.remove('opens-up');
    calendar.hidden = false;
    const bounds = calendar.getBoundingClientRect();
    const triggerBounds = trigger.getBoundingClientRect();
    if (calendarOpensUp(triggerBounds.top, triggerBounds.bottom, bounds.height, window.innerHeight)) calendar.classList.add('opens-up');
    trigger.setAttribute('aria-expanded', 'true');
  });
  picker.addEventListener('click', event => {
    const levelButton = event.target.closest('[data-level]');
    if (levelButton) { level = levelButton.dataset.level; render(); (calendar.querySelector('.date-picker-choices .is-selected') || calendar.querySelector('[data-level]')).focus(); return; }
    const year = event.target.closest('[data-year]');
    if (year) { const now = new Date(); const chosen = Number(year.dataset.year); view = new Date(chosen, chosen === now.getFullYear() ? Math.min(view.getMonth(), now.getMonth()) : view.getMonth(), 1); level = 'month'; render(); calendar.querySelector('.date-picker-choices .is-selected').focus(); return; }
    const choice = event.target.closest('[data-choice-month]');
    if (choice) { view = new Date(view.getFullYear(), Number(choice.dataset.choiceMonth), 1); level = 'day'; render(); calendar.querySelector('[data-level]').focus(); return; }
    const month = event.target.closest('[data-month]');
    if (month) { view = new Date(view.getFullYear(), view.getMonth() + Number(month.dataset.month), 1); render(); (calendar.querySelector(`[data-month="${month.dataset.month}"]:not(:disabled)`) || calendar.querySelector("[data-level]")).focus(); return; }
    const day = event.target.closest('[data-date]');
    if (!day && !event.target.closest('[data-clear]')) return;
    input.value = day ? day.dataset.date : '';
    picker.querySelector('[data-date-value]').textContent = displayDate(input.value);
    picker.querySelector('[data-date-value]').dataset.empty = String(!input.value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
    close(); trigger.focus();
  });
  picker.addEventListener('keydown', event => { if (event.key === 'Escape' && !calendar.hidden) { close(); trigger.focus(); } });
  picker.addEventListener('focusout', event => { if (!rendering && !picker.contains(event.relatedTarget)) close(); });
}
