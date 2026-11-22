import {escapeHTML} from '../utils/format.js';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = value => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : null;
};
const displayDate = value => {
  const date = parseDate(value);
  return date ? `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}` : 'Select date';
};

export function datePicker(value = '') {
  return `<div class="form-field"><span id="received-date-label">Date received</span><div class="date-picker" data-date-picker>
    <input type="hidden" name="receivedDate" value="${escapeHTML(value)}">
    <button type="button" class="form-control date-picker-trigger" aria-labelledby="received-date-label received-date-value" aria-expanded="false" aria-controls="received-date-calendar"><span id="received-date-value">${escapeHTML(displayDate(value))}</span><span aria-hidden="true">▦</span></button>
    <div id="received-date-calendar" class="date-picker-calendar" hidden></div></div></div>`;
}

function renderCalendar(picker, view) {
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
  picker.querySelector('.date-picker-calendar').innerHTML = `<div class="date-picker-header"><button type="button" data-month="-1" aria-label="Previous month"${view.getFullYear() === 1900 && view.getMonth() === 0 ? ' disabled' : ''}>←</button><div class="date-picker-selectors"><select data-select-month aria-label="Month">${months.map((month, index) => `<option value="${index}"${index === view.getMonth() ? ' selected' : ''}${view.getFullYear() === now.getFullYear() && index > now.getMonth() ? ' disabled' : ''}>${month}</option>`).join('')}</select><select data-select-year aria-label="Year">${Array.from({length: new Date().getFullYear() - 1899}, (_, index) => new Date().getFullYear() - index).map(year => `<option value="${year}"${year === view.getFullYear() ? ' selected' : ''}>${year}</option>`).join('')}</select></div><button type="button" data-month="1" aria-label="Next month"${view.getFullYear() === now.getFullYear() && view.getMonth() >= now.getMonth() ? ' disabled' : ''}>→</button></div><div class="date-picker-grid">${weekdays.map(day => `<span>${day}</span>`).join('')}${days}</div><button type="button" class="date-picker-clear" data-clear>Clear date</button>`;
}

export function initializeDatePicker(container) {
  const picker = container.querySelector('[data-date-picker]');
  if (!picker) return;
  const input = picker.querySelector('input');
  const trigger = picker.querySelector('.date-picker-trigger');
  const calendar = picker.querySelector('.date-picker-calendar');
  let view = parseDate(input.value) || new Date();
  let rendering = false;
  const render = () => { rendering = true; renderCalendar(picker, view); rendering = false; };
  const close = () => { calendar.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', () => {
    if (!calendar.hidden) return close();
    view = parseDate(input.value) || new Date();
    render();
    calendar.classList.remove('opens-up');
    calendar.hidden = false;
    const bounds = calendar.getBoundingClientRect();
    if (bounds.bottom > window.innerHeight && trigger.getBoundingClientRect().top > bounds.height) calendar.classList.add('opens-up');
    trigger.setAttribute('aria-expanded', 'true');
  });
  picker.addEventListener('click', event => {
    const month = event.target.closest('[data-month]');
    if (month) { view = new Date(view.getFullYear(), view.getMonth() + Number(month.dataset.month), 1); render(); (calendar.querySelector(`[data-month="${month.dataset.month}"]:not(:disabled)`) || calendar.querySelector("[data-select-month]")).focus(); return; }
    const day = event.target.closest('[data-date]');
    if (!day && !event.target.closest('[data-clear]')) return;
    input.value = day ? day.dataset.date : '';
    picker.querySelector('#received-date-value').textContent = displayDate(input.value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
    close(); trigger.focus();
  });
  calendar.addEventListener('change', event => {
    if (!event.target.matches('[data-select-month], [data-select-year]')) return;
    const year = Number(calendar.querySelector('[data-select-year]').value);
    const month = Number(calendar.querySelector('[data-select-month]').value);
    const now = new Date();
    view = new Date(year, year === now.getFullYear() ? Math.min(month, now.getMonth()) : month, 1);
    render();
    calendar.querySelector(event.target.matches('[data-select-month]') ? '[data-select-month]' : '[data-select-year]').focus();
  });
  picker.addEventListener('keydown', event => { if (event.key === 'Escape' && !calendar.hidden) { close(); trigger.focus(); } });
  picker.addEventListener('focusout', event => { if (!rendering && !picker.contains(event.relatedTarget)) close(); });
}
