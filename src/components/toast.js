const icons = {
  success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  warning: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3h.01"/>'
};

export function showToast(message, type = 'warning', options = {}) {
  if (!message) return null;
  const stack = document.getElementById('toast-stack');
  if (!stack) return null;
  const kind = Object.hasOwn(icons, type) ? type : 'warning';
  const toast = document.createElement('div');
  toast.className = `app-toast app-toast--${kind}`;
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  toast.innerHTML = `<svg class="app-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${icons[kind]}</svg><div class="app-toast-content"><strong>${kind === 'success' ? 'Success' : kind === 'error' ? 'Error' : 'Notice'}</strong><span></span></div><button class="app-toast-close" type="button" aria-label="Dismiss notification">×</button>`;
  toast.querySelector('.app-toast-content span').textContent = message;
  stack.prepend(toast);
  const timer = setTimeout(remove, 10000);
  function remove(silent = false) { clearTimeout(timer); toast.remove(); if (!silent) options.onDismiss?.(); }
  toast.querySelector('button').addEventListener('click', () => remove(), {once: true});
  return remove;
}
