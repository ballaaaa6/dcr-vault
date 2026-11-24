export function initializeCornerCloseAnimation() {
  const replaying = new WeakSet();
  document.addEventListener('click', event => {
    const button = event.target.closest('.identification-dialog .dialog-close, .dialog-close.location-close, .dialog-close.vault-photo-close, .dialog-close.photo-viewer-close');
    if (!button || replaying.has(button) || button.disabled || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.classList.contains('is-closing')) return;
    button.classList.add('is-closing');
    setTimeout(() => {
      button.classList.remove('is-closing');
      if (!button.isConnected || !button.closest('dialog')?.open) return;
      replaying.add(button);
      button.click();
      replaying.delete(button);
    }, 200);
  }, true);
}
