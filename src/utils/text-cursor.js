const textTypes = new Set(['text', 'search', 'url', 'tel', 'password']);

function editableText(element) {
  return element && !element.readOnly && !element.disabled &&
    (element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && textTypes.has(element.type)));
}

function moveToEnd(element) {
  const end = element.value.length;
  element.setSelectionRange(end, end);
}

export function initializeTextCursor(root = document) {
  let enteredByPointer = null;
  root.addEventListener('pointerdown', event => {
    enteredByPointer = editableText(event.target) && root.activeElement !== event.target ? event.target : null;
  }, true);
  root.addEventListener('focusin', event => {
    if (editableText(event.target)) moveToEnd(event.target);
  });
  root.addEventListener('pointerup', event => {
    const input = enteredByPointer;
    enteredByPointer = null;
    if (input === event.target && root.activeElement === input && input.selectionStart === input.selectionEnd) moveToEnd(input);
  });
  root.addEventListener('pointercancel', () => { enteredByPointer = null; });
}
