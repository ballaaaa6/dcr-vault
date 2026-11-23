import {escapeHTML} from '../utils/format.js';
import {calendarIcon, datePicker, displayDate, initializeDatePicker} from './date-picker.js';

export function editIconButton({id, label, controls, icon = 'pen'}) {
  const safeId = escapeHTML(id);
  const safeLabel = escapeHTML(label);
  const safeControls = escapeHTML(controls);
  const iconMarkup = icon === 'calendar' ? calendarIcon : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>`;
  return `<button class="inline-edit-button" id="${safeId}-edit" type="button" aria-label="Edit ${safeLabel}" aria-expanded="false" aria-controls="${safeControls}" data-edit>${iconMarkup}</button>`;
}

export function inlineEdit({id, label, value = '', displayValue = value, maxLength, required = false, displayTag = 'span', inputType = 'text'}) {
  const safeId = escapeHTML(id);
  const safeLabel = escapeHTML(label);
  const tag = displayTag === 'h2' ? 'h2' : 'span';
  const limit = Number.isInteger(maxLength) && maxLength > 0 ? ` maxlength="${maxLength}"` : '';
  const input = inputType === 'date' ? datePicker(value, {id: `${id}-date`, name: id, label}) : inputType === 'textarea' ? `<label class="inline-edit-label" for="${safeId}">${safeLabel}</label><div class="inline-edit-textarea"><textarea class="inline-edit-input" id="${safeId}"${limit}${limit ? ` aria-describedby="${safeId}-count"` : ''}>${escapeHTML(value)}</textarea>${limit ? `<span class="inline-edit-count" id="${safeId}-count" data-count>${value.length}/${maxLength} characters</span>` : ''}</div>` : `<label class="inline-edit-label" for="${safeId}">${safeLabel}</label><input class="inline-edit-input" id="${safeId}"${limit}${required ? ' required' : ''} value="${escapeHTML(value)}">`;
  return `<div class="inline-edit-row" data-inline-edit><${tag} class="inline-edit-display" id="${safeId}-display">${escapeHTML(displayValue)}</${tag}>${editIconButton({id, label, controls: `${id}-editor`, icon: inputType === 'date' ? 'calendar' : 'pen'})}<div class="inline-edit-editor" id="${safeId}-editor" hidden>${input}<button class="btn btn-primary" type="button" data-save>Save</button><button class="btn btn-ghost" type="button" data-cancel>Cancel</button></div></div><p class="inline-edit-status" role="status" aria-live="polite"></p>`;
}

export function initializeInlineEdit(row, {getValue, save, formatValue = value => value}) {
  const display = row.querySelector('.inline-edit-display');
  const edit = row.querySelector('[data-edit]');
  const editor = row.querySelector('.inline-edit-editor');
  const picker = row.querySelector('[data-date-picker]');
  const input = picker ? picker.querySelector('input') : row.querySelector('.inline-edit-input');
  if (picker) initializeDatePicker(row);
  const count = row.querySelector('[data-count]');
  const updateCount = () => { if (count) count.textContent = `${input.value.length}/${input.maxLength} characters`; };
  input.addEventListener?.('input', updateCount);
  const resetInput = () => { input.value = getValue() || ''; updateCount(); if (picker) picker.querySelector('[data-date-value]').textContent = displayDate(input.value); };
  const saveButton = row.querySelector('[data-save]');
  const status = row.nextElementSibling;
  const setEditing = active => { editor.hidden = !active; display.hidden = active; edit.hidden = active; edit.setAttribute('aria-expanded', String(active)); };
  input.onkeydown = event => { if (event.key === 'Enter' && input.tagName !== 'TEXTAREA') { event.preventDefault(); saveButton.click(); } };
  edit.onclick = () => { setEditing(true); status.textContent = ''; if (picker) { const trigger = picker.querySelector('.date-picker-trigger'); trigger.focus(); trigger.click(); } else input.focus(); };
  row.querySelector('[data-cancel]').onclick = () => { resetInput(); status.textContent = ''; setEditing(false); };
  saveButton.onclick = async () => {
    if (!input.reportValidity()) return;
    if (count && input.value.length > input.maxLength) { status.textContent = `Please use at most ${input.maxLength} characters.`; return; }
    saveButton.disabled = true; status.textContent = '';
    try { await save(input.value); resetInput(); display.textContent = formatValue(input.value); setEditing(false); }
    catch (error) { status.textContent = error.message; } finally { saveButton.disabled = false; }
  };
}
