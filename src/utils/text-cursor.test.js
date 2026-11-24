import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeTextCursor} from './text-cursor.js';

test('text inputs place the cursor at the end on entry while preserving later clicks and selections', () => {
  const handlers = {};
  const root = {addEventListener(name, handler) { handlers[name] = handler; }};
  const input = {tagName: 'INPUT', type: 'text', value: 'Card name', selectionStart: 0, selectionEnd: 0,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }};
  initializeTextCursor(root);
  handlers.pointerdown({target: input}); root.activeElement = input; handlers.focusin({target: input});
  input.selectionStart = input.selectionEnd = 2; handlers.pointerup({target: input});
  assert.equal(input.selectionStart, 9);
  handlers.pointerdown({target: input}); input.selectionStart = input.selectionEnd = 2; handlers.pointerup({target: input});
  assert.equal(input.selectionStart, 2);
  root.activeElement = null; handlers.pointerdown({target: input}); root.activeElement = input;
  input.selectionStart = 1; input.selectionEnd = 4; handlers.pointerup({target: input});
  assert.equal(input.selectionStart, 1);
  handlers.focusin({target: {...input, type: 'number', setSelectionRange() { assert.fail('number input'); }}});
});
