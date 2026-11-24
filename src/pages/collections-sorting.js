import {showToast} from '../components/toast.js';

export function initializeCollectionSorting(page, save) {
  let active, original, pointer, target, after;
  const rows = list => [...list.querySelectorAll(':scope > [data-sort-id]')];
  const announce = text => { page.querySelector('[data-sort-status]').textContent = text; };
  async function finish(commit) {
    if (!active) return;
    const {list, row} = active, handle = row.querySelector('.collections-drag-handle');
    if (!commit) original.forEach(item => list.append(item));
    row.classList.remove('is-dragging');
    list.querySelectorAll('.drop-before, .drop-after').forEach(item => item.classList.remove('drop-before', 'drop-after'));
    active = pointer = target = null;
    if (commit) {
      try { await save(rows(list).map(item => item.dataset.sortId)); announce('Order saved.'); }
      catch (error) { original.forEach(item => list.append(item)); showToast(error.message, 'error'); announce('Order could not be saved.'); }
    } else announce('Reordering cancelled.');
    handle.focus();
  }
  page.addEventListener('keydown', event => {
    const handle = event.target.closest('.collections-drag-handle');
    if (!handle) return;
    const row = handle.closest('[data-sort-id]'), list = row.parentElement;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (active) { if (active.row === row) finish(true); return; }
      active = {row, list}; original = rows(list); row.classList.add('is-dragging'); announce('Picked up. Use arrow keys to move.');
    } else if (active?.row === row && event.key === 'Escape') { event.preventDefault(); finish(false); }
    else if (active?.row === row && ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const items = rows(list), index = items.indexOf(row);
      const columns = getComputedStyle(list).gridTemplateColumns.split(' ').length;
      const offset = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns}[event.key];
      const next = Math.max(0, Math.min(items.length - 1, index + offset));
      if (next !== index) list.insertBefore(row, next > index ? items[next].nextSibling : items[next]);
      row.scrollIntoView({block: 'nearest'}); announce(`Position ${next + 1} of ${items.length}.`);
    }
  });
  page.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.collections-drag-handle');
    if (!handle || active || event.button !== 0) return;
    const row = handle.closest('[data-sort-id]');
    pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, row, list: row.parentElement};
    event.preventDefault();
  });
  document.addEventListener('pointermove', event => {
    if (!page.isConnected) { pointer = active = null; return; }
    if (!pointer || event.pointerId !== pointer.id) return;
    if (!active && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return;
    if (!active) { active = {row: pointer.row, list: pointer.list}; original = rows(active.list); active.row.classList.add('is-dragging'); }
    event.preventDefault();
    const candidates = rows(active.list).filter(row => row !== active.row);
    target = candidates.reduce((best, row) => {
      const rect = row.getBoundingClientRect(), distance = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
      return !best || distance < best.distance ? {row, rect, distance} : best;
    }, null);
    candidates.forEach(row => row.classList.remove('drop-before', 'drop-after'));
    if (target) { after = event.clientX > target.rect.left + target.rect.width / 2; target.row.classList.add(after ? 'drop-after' : 'drop-before'); }
  });
  document.addEventListener('pointerup', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (active && target) { active.list.insertBefore(active.row, after ? target.row.nextSibling : target.row); finish(true); }
    else if (active) finish(false); else pointer = null;
  });
  document.addEventListener('pointercancel', () => { if (active) finish(false); else pointer = null; });
}
