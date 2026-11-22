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


export function vaultSortSelect(id) {
  return `<label class="vault-status"><span class="sr-only">Sort by</span><select id="${id}" class="form-control"><option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option><option value="price-desc">Price: High to Low</option><option value="price-asc">Price: Low to High</option><option value="date-asc">Date: Oldest First</option><option value="date-desc" selected>Date: Newest First</option></select></label>`;
}
