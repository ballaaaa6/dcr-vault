// English only utilities
export function fmtMoney(n){ if(n==null||n==='') return '-'; return 'THB ' + Number(n).toLocaleString('en-US'); }
export function certUrl(cert){ return location.origin + location.pathname + '#/verify?cert=' + cert; }
export function escapeHTML(value) {
  const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  return String(value ?? '').replace(/[&<>"']/g, character => entities[character]);
}
