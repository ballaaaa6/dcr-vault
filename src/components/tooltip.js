import {escapeHTML} from '../utils/format.js';

// Supply a unique ID, a concise button label, and the tooltip message.
export function tooltip({id, label, message}) {
  const safeId = escapeHTML(id);
  return `<span class="shared-tooltip"><button type="button" class="shared-tooltip__trigger" aria-label="${escapeHTML(label)}" aria-describedby="${safeId}" aria-expanded="false">i</button><span class="shared-tooltip__content" id="${safeId}" role="tooltip">${escapeHTML(message)}</span></span>`;
}

export function initializeTooltips() {
  document.addEventListener('pointerdown', event => {
    const trigger = event.target.closest('.shared-tooltip__trigger');
    document.querySelectorAll('.shared-tooltip__trigger[aria-expanded="true"]').forEach(open => {
      if (open !== trigger) open.setAttribute('aria-expanded', 'false');
    });
    if (trigger && event.pointerType === 'touch') {
      trigger.setAttribute('aria-expanded', String(trigger.getAttribute('aria-expanded') !== 'true'));
    }
  });
  document.addEventListener('pointerover', event => {
    const tooltip = event.target.closest('.shared-tooltip');
    if (tooltip && !tooltip.contains(event.relatedTarget)) tooltip.classList.remove('is-dismissed');
  });
  document.addEventListener('focusin', event => {
    event.target.closest('.shared-tooltip')?.classList.remove('is-dismissed');
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.shared-tooltip').forEach(tooltip => {
      tooltip.classList.add('is-dismissed');
      tooltip.querySelector('.shared-tooltip__trigger').setAttribute('aria-expanded', 'false');
    });
  });
}
