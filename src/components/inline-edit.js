import {escapeHTML} from '../utils/format.js';

export function editIconButton({id, label, controls}) {
  const safeId = escapeHTML(id);
  const safeLabel = escapeHTML(label);
  const safeControls = escapeHTML(controls);
  return `<button class="inline-edit-button" id="${safeId}-edit" type="button" aria-label="Edit ${safeLabel}" aria-expanded="false" aria-controls="${safeControls}" data-edit><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>`;
}

export function inlineEdit({id, label, value = '', displayValue = value, maxLength, required = false, displayTag = 'span'}) {
  const safeId = escapeHTML(id);
  const safeLabel = escapeHTML(label);
  const tag = displayTag === 'h2' ? 'h2' : 'span';
  const limit = Number.isInteger(maxLength) && maxLength > 0 ? ` maxlength="${maxLength}"` : '';
  return `<div class="inline-edit-row" data-inline-edit><${tag} class="inline-edit-display" id="${safeId}-display">${escapeHTML(displayValue)}</${tag}>${editIconButton({id, label, controls: `${id}-editor`})}<div class="inline-edit-editor" id="${safeId}-editor" hidden><label class="inline-edit-label" for="${safeId}">${safeLabel}</label><input class="inline-edit-input" id="${safeId}"${limit}${required ? ' required' : ''} value="${escapeHTML(value)}"><button class="btn btn-primary" type="button" data-save>Save</button><button class="btn btn-ghost" type="button" data-cancel>Cancel</button></div></div><p class="inline-edit-status" role="status" aria-live="polite"></p>`;
}

export function initializeInlineEdit(row, {getValue, save}) {
  const display = row.querySelector('.inline-edit-display');
  const edit = row.querySelector('[data-edit]');
  const editor = row.querySelector('.inline-edit-editor');
  const input = row.querySelector('.inline-edit-input');
  const saveButton = row.querySelector('[data-save]');
  const status = row.nextElementSibling;
  const setEditing = active => { editor.hidden = !active; display.hidden = active; edit.hidden = active; edit.setAttribute('aria-expanded', String(active)); };
  input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); saveButton.click(); } };
  edit.onclick = () => { setEditing(true); status.textContent = ''; input.focus(); };
  row.querySelector('[data-cancel]').onclick = () => { input.value = getValue() || ''; status.textContent = ''; setEditing(false); };
  saveButton.onclick = async () => {
    if (!input.reportValidity()) return;
    saveButton.disabled = true; status.textContent = '';
    try { await save(input.value); input.value = getValue() || ''; display.textContent = input.value; setEditing(false); }
    catch (error) { status.textContent = error.message; } finally { saveButton.disabled = false; }
  };
}
