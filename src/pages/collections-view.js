import {escapeHTML as esc} from '../utils/format.js';
import {vaultImage} from '../components/card-item.js';
import {dropdown} from '../components/dropdown.js';
import {optionsIcon} from '../components/action-icons.js';
import {certificatePath} from '../utils/cert.js';

export function cardGrid(cards, reorder = false) {
  return `<div class="collections-grid">${cards.map(card => `<article class="collection-card surface-card" data-sort-id="${esc(card.id)}">
    <a href="${certificatePath(card.certNumber)}" class="collection-card-photo">${vaultImage(card, 'collection-photo-empty', 'No photo')}</a>
    <h3>${esc(card.name)}</h3><p>${esc(card.setName || '—')} ${esc(card.year || '')}</p><div class="collections-sort-line"><p>${esc(card.gradeLabel || '')}</p>${reorder ? dragHandle(card.name) : ''}</div>
    </article>`).join('')}</div>`;
}

function dragHandle(name) {
  return `<button type="button" class="collections-drag-handle" aria-label="Reorder ${esc(name)}" aria-describedby="collections-sort-help">⠿</button>`;
}

export function collectionsPage() {
  return `<main class="app-page collections-page"><p id="collections-sort-help" class="sr-only">Press Space to pick up, arrow keys to move, Space to save, or Escape to cancel.</p><div class="sr-only" aria-live="polite" data-sort-status></div><div id="collections-content"></div><dialog id="collections-dialog" class="content-dialog"><div class="content-dialog__panel" id="collections-dialog-content"></div><button class="dialog-close content-dialog__close" type="button" data-close aria-label="Close">×</button></dialog><dialog id="collections-delete-dialog" class="two-choice-dialog" aria-labelledby="collections-delete-title" aria-describedby="collections-delete-description"><button class="dialog-close" type="button" data-close aria-label="Close">×</button><h2 id="collections-delete-title"></h2><p id="collections-delete-description" class="two-choice-description">Cards will stay in Vault.<br>Shared links will no longer work.</p><div class="two-choice-actions"><button class="btn btn-ghost" type="button" data-close autofocus>Cancel</button><button class="btn btn-primary" type="button" data-action="confirm-delete">Delete</button></div></dialog></main>`;
}

export function collectionItems(groups, cards) {
  if (!groups.length) return '<p class="collections-no-results">No showcases match your search.</p>';
  return groups.map(group => {
    const cover = group.cardIds.map(id => cards.find(card => card.id === id)).find(Boolean);
    const count = group.cardIds.length;
    return `<article class="surface-card collections-item" data-sort-id="${esc(group.id)}">
      <button type="button" class="collections-delete" data-delete-id="${esc(group.id)}" aria-label="Delete ${esc(group.name)}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg></button>
      <button type="button" class="collections-open" data-open="${esc(group.id)}" aria-label="View ${esc(group.name)}"></button>
        <span class="collections-cover">${cover ? vaultImage(cover, 'collection-photo-empty', 'No photo') : '<span class="collection-photo-empty">No cards yet</span>'}</span>
        <span class="collections-item-body"><span class="collections-item-top"><strong>${esc(group.name)}</strong><span class="collections-badge ${group.shareToken ? 'collections-badge--public' : ''}">${group.shareToken ? 'Public' : 'Private'}</span></span>
        <span class="collections-description">${esc(group.description || '')}</span><span class="collections-sort-line"><small>${count} ${count === 1 ? 'card' : 'cards'}</small>${dragHandle(group.name)}</span><span class="collections-view-link">View showcase <span aria-hidden="true">→</span></span></span>
      </article>`;
  }).join('');
}

export function listView(groups, cards) {
  return `<header class="page-heading collections-heading"><div><h1>Showcase</h1><p class="page-description">Organize your cards and share the ones you choose.</p></div><button class="btn btn-primary" data-action="create">+ Create</button></header>
    ${groups.length ? `<div class="collections-list-toolbar">${dropdown({id: 'collections-sort', label: 'Sort showcases', value: 'custom', options: [['custom', 'Custom order'], ['name', 'Name A–Z'], ['count', 'Most cards']]})}<label class="collections-search"><span class="sr-only">Search showcases</span><input class="form-control" id="collections-search" type="search" placeholder="Search showcases"></label></div><div class="collections-list" id="collections-list">${collectionItems(groups, cards)}</div>` : `<section class="surface-card collections-empty"><h2>Create your first showcase</h2><p>Choose cards from Vault to make a showcase. Keep it private or share it when you are ready.</p><button class="btn btn-primary" data-action="create">+ Create</button></section>`}`;
}

export function detailView(group, cards, preview = false) {
  const selected = group.cardIds.map(id => cards.find(card => card.id === id)).filter(Boolean);
  return `<header class="collections-detail-heading"><div class="collections-detail-title"><h1>${esc(group.name)}</h1><span>${selected.length} ${selected.length === 1 ? 'card' : 'cards'}</span></div>${preview ? '<button class="btn btn-ghost" data-action="preview">Close preview</button>' : `<div class="collections-detail-actions"><button class="btn btn-primary" data-action="add">+ Add cards</button><details class="collections-detail-options dropdown-control"><summary aria-label="Showcase settings">${optionsIcon()}</summary><div class="dropdown-menu"><button type="button" data-action="edit">Edit</button><button type="button" data-action="preview">Preview</button><button type="button" data-action="share">${group.shareToken ? 'Manage sharing' : 'Share'}</button><button type="button" data-action="delete">Delete showcase</button></div></details></div>`}<p class="page-description collections-detail-description">${esc(group.description || '')}</p></header>
    ${preview ? '<p class="page-description">Anyone with the link can view and forward it. Certificate details and card photos may already be public.</p>' : ''}
    ${selected.length ? cardGrid(selected, !preview) : '<section class="surface-card collections-empty"><h2>No cards in this showcase yet</h2><p>Add cards from Vault to get started.</p></section>'}`;
}

export function sharedView(group) {
  return `<main class="app-page collections-page"><header class="page-heading"><h1>${esc(group.name)}</h1><p class="page-description">${esc(group.description || '')}</p><p>${group.cards.length} cards</p></header>${group.cards.length ? cardGrid(group.cards) : '<section class="surface-card collections-empty"><h2>No cards in this showcase yet</h2></section>'}</main>`;
}
