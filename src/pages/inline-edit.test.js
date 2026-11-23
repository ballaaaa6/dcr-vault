import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineEdit, initializeInlineEdit} from '../components/inline-edit.js';

test('inline editor saves, cancels, and displays errors without losing edits', async () => {
  const display = {hidden: false, textContent: 'Original'};
  const edit = {hidden: false, setAttribute(name, value) { this[name] = value; }};
  const editor = {hidden: true};
  const input = {value: 'Original', reportValidity: () => true, focus() { this.focused = true; }};
  const saveButton = {};
  const cancel = {};
  const status = {textContent: ''};
  const nodes = {'.inline-edit-display': display, '[data-edit]': edit, '.inline-edit-editor': editor, '.inline-edit-input': input, '[data-save]': saveButton, '[data-cancel]': cancel};
  const row = {querySelector: selector => nodes[selector], nextElementSibling: status};
  let current = 'Original';
  let fail = false;
  initializeInlineEdit(row, {getValue: () => current, save: async value => { if (fail) throw new Error('Save failed'); current = value.trim(); }});
  edit.onclick();
  assert.equal(input.focused, true);
  assert.equal(edit['aria-expanded'], 'true');
  input.value = '  Updated  ';
  await saveButton.onclick();
  assert.equal(display.textContent, 'Updated');
  assert.equal(editor.hidden, true);
  edit.onclick();
  input.value = 'Draft';
  cancel.onclick();
  assert.equal(input.value, 'Updated');
  edit.onclick();
  input.value = 'Retry';
  fail = true;
  await saveButton.onclick();
  assert.equal(status.textContent, 'Save failed');
  assert.equal(editor.hidden, false);
  assert.equal(input.value, 'Retry');
  assert.equal(saveButton.disabled, false);
});

test('inline editor escapes values and links its accessible controls', () => {
  const markup = inlineEdit({id: 'name', label: 'Name', value: '<test>', required: true, maxLength: 20});
  assert.match(markup, /value="&lt;test&gt;"/);
  assert.match(markup, /aria-controls="name-editor"/);
  assert.match(markup, /maxlength="20" required/);
});

 test('date and multiline variants render the appropriate controls', () => {
  const date = inlineEdit({id: 'since', label: 'Collecting since', inputType: 'date'});
  assert.match(date, /data-date-picker/);
  assert.match(date, /<rect x="3" y="5"/);
  const bio = inlineEdit({id: 'bio', label: 'Short bio', inputType: 'textarea', value: 'First\nSecond'});
  assert.match(bio, /<textarea[^>]*>First\nSecond<\/textarea>/);
});

 test('limited multiline editor updates and resets its character count', () => {
  const count = {textContent: ''};
  const input = {value: 'Saved', maxLength: 200, addEventListener(name, fn) { this[name] = fn; }, focus() {}};
  const nodes = {'.inline-edit-display': {}, '[data-edit]': {setAttribute() {}}, '.inline-edit-editor': {}, '.inline-edit-input': input, '[data-save]': {}, '[data-cancel]': {}, '[data-count]': count};
  initializeInlineEdit({querySelector: selector => nodes[selector], nextElementSibling: {}}, {getValue: () => 'Saved', save: async () => {}});
  input.value = 'Draft'; input.input();
  assert.equal(count.textContent, '5/200 characters');
  nodes['[data-cancel]'].onclick();
  assert.equal(count.textContent, '5/200 characters');
  assert.match(inlineEdit({id: 'bio', label: 'Bio', inputType: 'textarea', maxLength: 200}), /0\/200 characters/);
});
