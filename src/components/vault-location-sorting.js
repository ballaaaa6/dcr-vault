export function initializeLocationSorting(body, save) {
  const list = body.querySelector('.location-list');
  if (!list) return;
  let active = null;
  let original = [];
  let target = null;
  let after = false;
  let pointer = null;
  let moved = false;
  const rows = () => [...list.querySelectorAll('.location-row')];
  const announce = message => { body.querySelector('[data-location-sort-status]').textContent = message; };
  function clear() { rows().forEach(row => row.classList.remove('is-dragging', 'drop-before', 'drop-after')); target = null; }
  async function finish(commit) {
    if (!active) return;
    const handle = active.querySelector('button');
    if (!commit) original.forEach(row => list.append(row));
    clear(); active = null; pointer = null;
    let saved = false;
    if (commit) saved = await save(rows().map(row => row.dataset.locationId));
    if (commit && !saved) original.forEach(row => list.append(row));
    handle.focus();
    announce(commit ? (saved ? 'Location order updated.' : 'Location order could not be saved.') : 'Reordering cancelled.');
  }
  list.addEventListener('keydown', event => {
    const handle = event.target.closest('.location-drag-handle');
    if (!handle) return;
    const row = handle.closest('.location-row');
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (active) { if (active === row) finish(true); return; }
      active = row; original = rows(); row.classList.add('is-dragging'); announce('Location picked up. Use arrow keys to move.');
    } else if (active === row && event.key === 'Escape') { event.preventDefault(); finish(false); }
    else if (active === row && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const sibling = event.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
      if (sibling) { list.insertBefore(row, event.key === 'ArrowUp' ? sibling : sibling.nextSibling); row.scrollIntoView({block: 'nearest'}); announce(`Position ${rows().indexOf(row) + 1} of ${rows().length}.`); }
    }
  });
  list.addEventListener('pointerdown', event => {
    if (active || event.button !== 0 || event.target.closest('.location-menu')) return;
    const row = event.target.closest('.location-row');
    if (!row) return;
    pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, row}; moved = false;
    if (event.target.closest('.location-drag-handle')) event.preventDefault();
  });
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', cancel);
  function move(event) {
    if (!list.isConnected) return cleanup();
    if (!pointer || event.pointerId !== pointer.id) return;
    if (!moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return;
    if (!moved) { moved = true; active = pointer.row; original = rows(); active.classList.add('is-dragging'); }
    event.preventDefault();
    const visible = rows().filter(row => row !== active);
    target = visible.find(row => event.clientY < row.getBoundingClientRect().bottom) || visible.at(-1);
    rows().forEach(row => row.classList.remove('drop-before', 'drop-after'));
    if (target) { after = event.clientY > target.getBoundingClientRect().top + target.offsetHeight / 2; target.classList.add(after ? 'drop-after' : 'drop-before'); }
    const rect = list.getBoundingClientRect();
    if (event.clientY < rect.top + 30) list.scrollTop -= 10;
    if (event.clientY > rect.bottom - 30) list.scrollTop += 10;
  }
  function up(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (moved && target) { list.insertBefore(active, after ? target.nextSibling : target); finish(true); }
    else if (moved) finish(false);
    else pointer = null;
  }
  function cancel() { if (active) finish(false); else pointer = null; }
  function cleanup() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); }
}
