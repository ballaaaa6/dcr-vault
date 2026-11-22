import {dropdown} from '../components/dropdown.js';

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
  return `<div class="vault-status">${dropdown({id, label: 'Sort by', options: sortOptions, value: 'date-desc', align: id === 'label-vault-sort' ? 'end' : 'start'})}</div>`;
}
