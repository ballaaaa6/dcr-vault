import {escapeHTML as esc} from '../utils/format.js';
import {vaultImage} from '../components/card-item.js';
import {dropdown} from '../components/dropdown.js';
import {optionsIcon} from '../components/action-icons.js';
import {certificatePath} from '../utils/cert.js';

export function cardGrid(cards) {
  return `<div class="collections-grid">${cards.map(card => `<article class="collection-card surface-card">
    <a href="${certificatePath(card.certNumber)}" class="collection-card-photo">${vaultImage(card, 'collection-photo-empty', 'No photo')}</a>
    <h3>${esc(card.name)}</h3><p>${esc(card.setName || '—')} ${esc(card.year || '')}</p><p>${esc(card.gradeLabel || '')}</p>
    </article>`).join('')}</div>`;
}

export function collectionsPage() {
  return `<main class="app-page collections-page"><div id="collections-content"></div><dialog id="collections-dialog" class="content-dialog"><div class="content-dialog__panel" id="collections-dialog-content"></div><button class="dialog-close content-dialog__close" type="button" data-close aria-label="Close">×</button></dialog></main>`;
}

export function collectionItems(groups, cards) {
  if (!groups.length) return '<p class="collections-no-results">No showcases match your search.</p>';
  return groups.map(group => {
    const cover = group.cardIds.map(id => cards.find(card => card.id === id)).find(Boolean);
    const count = group.cardIds.length;
    return `<article class="surface-card collections-item">
      <button type="button" class="collections-open" data-open="${esc(group.id)}" aria-label="View ${esc(group.name)}">
        <span class="collections-cover">${cover ? vaultImage(cover, 'collection-photo-empty', 'No photo') : '<span class="collection-photo-empty">No cards yet</span>'}</span>
        <span class="collections-item-body"><span class="collections-item-top"><strong>${esc(group.name)}</strong><span class="collections-badge ${group.shareToken ? 'collections-badge--public' : ''}">${group.shareToken ? 'Public' : 'Private'}</span></span>
        <span class="collections-description">${esc(group.description || '')}</span><small>${count} ${count === 1 ? 'card' : 'cards'}</small><span class="collections-view-link">View showcase <span aria-hidden="true">→</span></span></span>
      </button></article>`;
  }).join('');
}

export function listView(groups, cards) {
  return `<header class="page-heading collections-heading"><div><h1>Showcase</h1><p class="page-description">Organize your cards and share the ones you choose.</p></div><button class="btn btn-primary" data-action="create">+ Create</button></header>
    ${groups.length ? `<div class="collections-list-toolbar">${dropdown({id: 'collections-sort', label: 'Sort showcases', value: 'name', options: [['name', 'Name A–Z'], ['count', 'Most cards']]})}<label class="collections-search"><span class="sr-only">Search showcases</span><input class="form-control" id="collections-search" type="search" placeholder="Search showcases"></label></div><div class="collections-list" id="collections-list">${collectionItems([...groups].sort((a, b) => a.name.localeCompare(b.name)), cards)}</div>` : `<section class="surface-card collections-empty"><h2>Create your first showcase</h2><p>Choose cards from Vault to make a showcase. Keep it private or share it when you are ready.</p><button class="btn btn-primary" data-action="create">+ Create</button></section>`}`;
}

export function detailView(group, cards, preview = false) {
  const selected = group.cardIds.map(id => cards.find(card => card.id === id)).filter(Boolean).map(card => preview ? {...card, referenceImage: ''} : card);
  return `<header class="collections-detail-heading"><div class="collections-detail-title"><h1>${esc(group.name)}</h1><span>${selected.length} ${selected.length === 1 ? 'card' : 'cards'}</span>${preview ? '' : '<button class="btn btn-primary" data-action="add">+ Add cards</button>'}</div>${preview ? '<button class="btn btn-ghost" data-action="preview">Close preview</button>' : `<details class="collections-detail-options"><summary aria-label="Showcase settings">${optionsIcon()}</summary><div class="dropdown-menu"><button type="button" data-action="edit">Edit</button><button type="button" data-action="preview">Preview</button><button type="button" data-action="share">${group.shareToken ? 'Manage sharing' : 'Share'}</button><button type="button" data-action="manage-cards">Manage cards</button><button type="button" data-action="delete">Delete showcase</button><button type="button" data-action="back">All showcases</button></div></details>`}<p class="page-description collections-detail-description">${esc(group.description || '')}</p></header>
    ${preview ? '<p class="page-description">Anyone with the link can view and forward it. Certificate details and card photos may already be public.</p>' : ''}
    ${selected.length ? cardGrid(selected) : '<section class="surface-card collections-empty"><h2>No cards in this showcase yet</h2><p>Add cards from Vault to get started.</p></section>'}`;
}

export function sharedView(group) {
  return `<main class="app-page collections-page"><header class="page-heading"><h1>${esc(group.name)}</h1><p class="page-description">${esc(group.description || '')}</p><p>${group.cards.length} cards</p></header>${group.cards.length ? cardGrid(group.cards) : '<section class="surface-card collections-empty"><h2>No cards in this showcase yet</h2></section>'}</main>`;
}
