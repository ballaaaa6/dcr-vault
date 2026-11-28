const selector = [
  'button:has(> .action-icon)', 'summary:has(> .action-icon)', '.corner-switch',
  '.collections-delete', '.label-clear', '.dialog-close', '.upload-clear',
  '.profile-avatar-remove', '[data-viewer-download]', '[data-cert-random]'
].join(',');

export function initializeActionTooltips() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let active;
  let tip;
  const hide = () => { tip?.remove(); tip = null; active = null; };
  document.addEventListener('pointerover', event => {
    const button = event.target.closest(selector);
    if (!button || button === active || button.disabled || !button.getAttribute('aria-label')) return;
    hide();
    active = button;
    tip = document.createElement('span');
    tip.className = 'action-tooltip';
    tip.setAttribute('aria-hidden', 'true');
    tip.textContent = button.getAttribute('aria-label');
    (button.closest('dialog[open]') || document.body).append(tip);
    const rect = button.getBoundingClientRect();
    const bounds = tip.getBoundingClientRect();
    const left = Math.max(8, Math.min(innerWidth - bounds.width - 8, rect.left + rect.width / 2 - bounds.width / 2));
    const top = rect.top - bounds.height - 9 >= 8 ? rect.top - bounds.height - 9 : rect.bottom + 9;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
  document.addEventListener('pointerout', event => {
    if (active && !active.contains(event.relatedTarget)) hide();
  });
  document.addEventListener('click', hide);
  document.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
}
