import {escapeHTML} from '../utils/format.js';

// Supply a unique ID, a concise button label, and the tooltip message.
export function tooltip({id, label, message}) {
  const safeId = escapeHTML(id);
  return `<span class="shared-tooltip"><button type="button" class="shared-tooltip__trigger" aria-label="${escapeHTML(label)}" aria-describedby="${safeId}">i</button><span class="shared-tooltip__content" id="${safeId}" role="tooltip">${escapeHTML(message)}</span></span>`;
}

export function initializeTooltips() {
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.activeElement?.matches('.shared-tooltip__trigger')) {
      document.activeElement.blur();
    }
  });
}
