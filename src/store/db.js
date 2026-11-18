const LEGACY_KEY = 'dcr-cards-v1';

export function loadLegacyCards() {
  try {
    const records = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    return Array.isArray(records) ? records.filter(record => record && typeof record === 'object') : [];
  } catch {
    return [];
  }
}

export function hasImportDecision(userId) {
  try { return Boolean(userId && localStorage.getItem(`dcr-import-choice:${userId}`)); }
  catch { return false; }
}

export function rememberImportDecision(userId) {
  try { if (userId) localStorage.setItem(`dcr-import-choice:${userId}`, 'complete'); }
  catch {}
}
