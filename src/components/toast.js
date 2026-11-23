const icons = {
  success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  warning: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3h.01"/>'
};

const activeToasts = new Map();

export function dismissToast(key) {
  activeToasts.get(key)?.remove(true);
}

export function showToast(message, type = 'warning', options = {}) {
  if (!message) return null;
  const stack = document.getElementById('toast-stack');
  if (!stack) return null;
  const kind = Object.hasOwn(icons, type) ? type : 'warning';
  let entry = options.key && activeToasts.get(options.key);
  if (!entry || !entry.toast.isConnected) {
    const toast = document.createElement('div');
    toast.innerHTML = `<svg class="app-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"></svg><div class="app-toast-content"><strong></strong><span></span></div><button class="app-toast-close" type="button" aria-label="Dismiss notification">×</button>`;
    entry = {toast, timer: null, onDismiss: null};
    entry.remove = (silent = false) => {
      clearTimeout(entry.timer);
      toast.remove();
      if (options.key && activeToasts.get(options.key) === entry) activeToasts.delete(options.key);
      if (!silent) entry.onDismiss?.();
    };
    toast.querySelector('button').addEventListener('click', () => entry.remove());
    stack.prepend(toast);
    if (options.key) activeToasts.set(options.key, entry);
  }
  clearTimeout(entry.timer);
  entry.onDismiss = options.onDismiss;
  const toast = entry.toast;
  toast.className = `app-toast app-toast--${kind}${options.pending ? ' app-toast--pending' : ''}`;
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  toast.querySelector('svg').innerHTML = icons[kind];
  toast.querySelector('strong').textContent = kind === 'success' ? 'Success' : kind === 'error' ? 'Error' : 'Notice';
  toast.querySelector('.app-toast-content span').textContent = message;
  toast.classList.remove('app-toast--timed');
  void toast.offsetWidth;
  if (!options.pending) {
    toast.classList.add('app-toast--timed');
    entry.timer = setTimeout(() => entry.remove(), 6000);
  }
  return entry.remove;
}
