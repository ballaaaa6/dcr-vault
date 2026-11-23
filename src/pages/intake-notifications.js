import {showToast} from '../components/toast.js';

export function intakeNotificationType(message, source, state = '') {
  if (source === 'm-cert-status') return state === 'available' ? 'success' : state === 'error' ? 'error' : 'warning';
  if (state === 'error') return 'error';
  if (source === 'photo-status') return message === 'Photo selection cleared.' ? 'success' : 'error';
  if (/^(Catalog card selected|Candidate selected)/i.test(message)) return 'success';
  if (/^(Complete all required|Use English|Card saved\. Retry|Could not|Card reading (is not configured|is busy|is unavailable|is temporarily unavailable|could not)|Card suggestions are unavailable|The card could not be saved)/i.test(message)) return 'error';
  return 'warning';
}

export function initializeIntakeNotifications() {
  const statuses = document.querySelectorAll('.intake-status-sources [role="status"]');
  const active = new WeakMap();
  const observer = new MutationObserver(records => {
    for (const status of new Set(records.map(record => record.target.nodeType === 1 ? record.target : record.target.parentElement))) {
      if (!status || !status.matches('[role="status"]')) continue;
      active.get(status)?.(true);
      active.delete(status);
      const message = status.textContent.trim();
      if (!message) continue;
      const remove = showToast(message, intakeNotificationType(message, status.id, status.dataset.state), {
        onDismiss: () => { if (status.textContent.trim() === message) status.textContent = ''; }
      });
      if (status.id !== 'm-cert-status') delete status.dataset.state;
      if (remove) active.set(status, remove);
    }
  });
  statuses.forEach(status => observer.observe(status, {childList: true, characterData: true, subtree: true}));
  return observer;
}
