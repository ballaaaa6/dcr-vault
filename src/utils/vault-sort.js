export function compareVaultCards(a, b, sort) {
  const [field, direction] = sort.split('-');
  const sign = direction === 'desc' ? -1 : 1;
  if (field === 'name') return sign * a.name.localeCompare(b.name);
  const key = field === 'price' ? 'buyPrice' : 'receivedDate';
  const missing = card => card[key] == null || card[key] === '';
  if (missing(a) || missing(b)) return Number(missing(a)) - Number(missing(b));
  if (field === 'price') {
    const group = (a.buyCurrency || 'THB').localeCompare(b.buyCurrency || 'THB');
    return group || sign * (Number(a.buyPrice) - Number(b.buyPrice));
  }
  return sign * a.receivedDate.localeCompare(b.receivedDate);
}


const sortOptions = [
  ['name-asc', 'Name: A–Z'], ['name-desc', 'Name: Z–A'],
  ['price-desc', 'Price: High to Low'], ['price-asc', 'Price: Low to High'],
  ['date-asc', 'Date: Oldest First'], ['date-desc', 'Date: Newest First']
];

export function vaultSortSelect(id) {
  const options = sortOptions.map(([value, label]) => `<option value="${value}"${value === 'date-desc' ? ' selected' : ''}>${label}</option>`).join('');
  const items = sortOptions.map(([value, label]) => `<button type="button" role="menuitemradio" aria-checked="${value === 'date-desc'}" data-sort-value="${value}"><span>${label}</span><span class="vault-sort-check" aria-hidden="true">✓</span></button>`).join('');
  return `<div class="vault-status"><select id="${id}" class="sr-only" tabindex="-1" aria-hidden="true">${options}</select><details class="vault-sort"><summary aria-label="Sort by: Date: Newest First"><span data-sort-label>Date: Newest First</span><svg class="vault-sort-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg></summary><div class="vault-sort-menu" role="menu" aria-label="Sort by">${items}</div></details></div>`;
}

document.addEventListener('click', event => {
  const item = event.target.closest('[data-sort-value]');
  document.querySelectorAll('.vault-sort[open]').forEach(menu => {
    if (!menu.contains(event.target)) menu.open = false;
  });
  if (!item) return;
  const menu = item.closest('.vault-sort');
  const select = menu.parentElement.querySelector('select');
  select.value = item.dataset.sortValue;
  menu.querySelectorAll('[data-sort-value]').forEach(option => option.setAttribute('aria-checked', String(option === item)));
  const label = item.querySelector('span').textContent;
  menu.querySelector('[data-sort-label]').textContent = label;
  menu.querySelector('summary').setAttribute('aria-label', `Sort by: ${label}`);
  menu.open = false;
  menu.querySelector('summary').focus();
  select.dispatchEvent(new Event('change', {bubbles: true}));
});

document.addEventListener('keydown', event => {
  const menu = event.target.closest('.vault-sort');
  if (!menu || !menu.open) return;
  if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); event.preventDefault(); }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = [...menu.querySelectorAll('[data-sort-value]')];
  const index = items.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next].focus();
  event.preventDefault();
});

document.addEventListener('change', event => {
  if (event.target.id === 'vault-sort') window.__filterVault();
});
