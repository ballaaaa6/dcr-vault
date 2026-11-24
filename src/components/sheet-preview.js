// Change to "scroll" to restore the original vertically scrolling preview.
const sheetPreviewMode = 'pages';

export function sheetPreviewMarkup(sheets) {
  const paged = sheetPreviewMode === 'pages';
  const pairs = sheets.map((sheet, index) => paged && index ? sheet.replace('class="sheet-preview-pair"', 'class="sheet-preview-pair" hidden') : sheet).join('');
  const controls = sheets.length > 1 && paged ? `<nav class="sheet-pagination-wrap" aria-label="Sheet pages"><div class="sheet-pagination">${sheets.map((_, index) => `<button type="button" class="sheet-pagination-dot" data-sheet-index="${index}" aria-label="Sheet ${index + 1}" ${index === 0 ? 'aria-current="page"' : ''}>${index === 0 ? '<span class="sheet-pacman" aria-hidden="true"></span>' : ''}</button>`).join('')}</div></nav>` : '';
  return `<div class="sheet-preview-pages ${paged ? 'sheet-preview-paged' : ''}">${pairs}</div>${controls}`;
}

export function initializeSheetPreview(content) {
  const nav = content.querySelector('.sheet-pagination');
  if (!nav) return;
  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-sheet-index]');
    if (!button || button.hasAttribute('aria-current')) return;
    const pacman = nav.querySelector('.sheet-pacman');
    const from = pacman.getBoundingClientRect();
    nav.querySelector('[aria-current]').removeAttribute('aria-current');
    button.setAttribute('aria-current', 'page');
    button.append(pacman);
    const to = pacman.getBoundingClientRect();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pacman.animate([{transform: `translate(${from.left - to.left}px, 0)`}, {transform: 'translate(0, 0)'}], {duration: 250, easing: 'linear'});
    }
    content.querySelectorAll('.sheet-preview-pair').forEach((pair, index) => { pair.hidden = index !== Number(button.dataset.sheetIndex); });
  });
}
