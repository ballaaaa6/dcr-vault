import {escapeHTML as esc} from '../utils/format.js';
import {getCollections, getLocations} from './vault-locations.js';

function options(items, selected, type, all) {
  return [['', all], ...items.map(item => [item.id, item.name])].map(([id, label]) =>
    `<button type="button" role="menuitemradio" aria-checked="${id === selected}" data-vault-filter="${type}" data-value="${esc(id)}"><span>${esc(label)}</span><span class="dropdown-check" aria-hidden="true">✓</span></button>`).join('');
}

export function vaultFilter(location = '', collection = '') {
  const loc = getLocations().find(item => item.id === location);
  const col = getCollections().find(item => item.id === collection);
  const label = [loc?.name, col?.name].filter(Boolean).join(' · ') || 'All cards';
  return `<div class="dropdown"><input type="hidden" id="vault-location-filter" value="${esc(loc?.id || '')}"><input type="hidden" id="vault-collection-filter" value="${esc(col?.id || '')}">
    <details class="dropdown-control vault-filter"><summary aria-label="Filter cards: ${esc(label)}"><span data-vault-filter-label>${esc(label)}</span><svg class="dropdown-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg></summary>
    <div class="dropdown-menu" role="menu" aria-label="Filter cards"><div class="vault-filter-heading">Storage location</div>${options(getLocations(), loc?.id || '', 'location', 'All locations')}
    <button type="button" role="menuitem" class="dropdown-action" data-manage-locations><img class="dropdown-action-icon" src="/assets/lucide-settings.svg" alt=""><span>Manage</span></button>
    <div class="vault-filter-heading">Collections</div>${options(getCollections(), col?.id || '', 'collection', 'All collections')}
    <button type="button" role="menuitem" class="dropdown-action" data-manage-collections><img class="dropdown-action-icon" src="/assets/lucide-settings.svg" alt=""><span>Manage</span></button></div></details></div>`;
}

export function initializeVaultFilter(canChange = async () => true) {
  document.getElementById('location-filter-wrap')?.addEventListener?.('click', async event => {
    const button = event.target.closest('[data-vault-filter]');
    if (!button) return;
    if (!await canChange()) return;
    const location = button.dataset.vaultFilter === 'location' ? button.dataset.value : document.getElementById('vault-location-filter').value;
    const collection = button.dataset.vaultFilter === 'collection' ? button.dataset.value : document.getElementById('vault-collection-filter').value;
    document.getElementById('location-filter-wrap').innerHTML = vaultFilter(location, collection);
    document.querySelector('.vault-filter summary')?.focus();
    if (document.getElementById('vault-q')) window.__filterVault();
  });
}
