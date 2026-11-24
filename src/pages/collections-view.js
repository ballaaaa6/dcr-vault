import {escapeHTML as esc} from '../utils/format.js';
import {vaultImage} from '../components/card-item.js';
import {dropdown} from '../components/dropdown.js';
import {optionsIcon} from '../components/action-icons.js';
import {certificatePath} from '../utils/cert.js';

export function cardGrid(cards, owner = false) {
  return `<div class="collections-grid">${cards.map((card, index) => `<article class="collection-card surface-card">
    <a href="${certificatePath(card.certNumber)}" class="collection-card-photo">${vaultImage(card, 'collection-photo-empty', 'No photo')}</a>
    <h3>${esc(card.name)}</h3><p>${esc(card.setName || '—')} ${esc(card.year || '')}</p><p>${esc(card.gradeLabel || '')}</p>
    ${owner ? `<div class="collection-card-actions"><button type="button" class="btn btn-ghost" data-move="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="Move ${esc(card.name)} earlier">↑</button><button type="button" class="btn btn-ghost" data-move="${index}" data-direction="1" ${index === cards.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(card.name)} later">↓</button><button type="button" class="btn btn-ghost" data-remove="${esc(card.id)}">Remove</button></div>` : ''}</article>`).join('')}</div>`;
}

export function collectionsPage() {
  return `<main class="app-page collections-page"><div id="collections-content"></div><dialog id="collections-dialog" class="collections-dialog"><div id="collections-dialog-content"></div></dialog></main>`;
}

export function collectionItems(groups, cards) {
  if (!groups.length) return '<p class="collections-no-results">No collections match your search.</p>';
  return groups.map(group => {
    const cover = group.cardIds.map(id => cards.find(card => card.id === id)).find(Boolean);
    const count = group.cardIds.length;
    return `<article class="surface-card collections-item">
      <button type="button" class="collections-open" data-open="${esc(group.id)}" aria-label="View ${esc(group.name)}">
        <span class="collections-cover">${cover ? vaultImage(cover, 'collection-photo-empty', 'No photo') : '<span class="collection-photo-empty">No cards yet</span>'}</span>
        <span class="collections-item-body"><span class="collections-item-top"><strong>${esc(group.name)}</strong><span class="collections-badge">${group.shareToken ? 'Shared by link' : 'Private'}</span></span>
        ${group.description ? `<span class="collections-description">${esc(group.description)}</span>` : ''}<small>${count} ${count === 1 ? 'card' : 'cards'}</small><span class="collections-view-link">View collection <span aria-hidden="true">→</span></span></span>
      </button><details class="collections-options"><summary aria-label="Options for ${esc(group.name)}">${optionsIcon()}</summary><div class="dropdown-menu"><button type="button" data-group-action="edit" data-group-id="${esc(group.id)}">Edit</button><button type="button" data-group-action="share" data-group-id="${esc(group.id)}">${group.shareToken ? 'Manage sharing' : 'Share'}</button><button type="button" data-group-action="delete" data-group-id="${esc(group.id)}">Delete</button></div></details></article>`;
  }).join('');
}

export function listView(groups, cards) {
  return `<header class="page-heading collections-heading"><div><h1>Collections</h1><p class="page-description">Organize your cards and share the ones you choose.</p></div><button class="btn btn-primary" data-action="create">+ Create collection</button></header>
    ${groups.length ? `<div class="collections-list-toolbar"><label class="collections-search"><span class="sr-only">Search collections</span><input class="form-control" id="collections-search" type="search" placeholder="Search collections"></label>${dropdown({id: 'collections-sort', label: 'Sort collections', value: 'name', options: [['name', 'Name A–Z'], ['count', 'Most cards']]})}</div><div class="collections-list" id="collections-list">${collectionItems([...groups].sort((a, b) => a.name.localeCompare(b.name)), cards)}</div>` : `<section class="surface-card collections-empty"><h2>Create your first collection</h2><p>Choose cards from My Vault to make a collection. Keep it private or share it when you are ready.</p><button class="btn btn-primary" data-action="create">+ Create collection</button></section>`}`;
}

export function detailView(group, cards, preview = false) {
  const selected = group.cardIds.map(id => cards.find(card => card.id === id)).filter(Boolean).map(card => preview ? {...card, referenceImage: ''} : card);
  return `<button class="btn btn-ghost" data-action="back">← Collections</button><header class="page-heading collections-heading"><div><p class="collection-status">${preview ? 'Share preview' : group.shareToken ? 'Shared by link' : 'Private'}</p><h1>${esc(group.name)}</h1><p class="page-description">${esc(group.description || '')}</p><p>${selected.length} cards</p></div>${preview ? '<button class="btn btn-ghost" data-action="preview">Close preview</button>' : `<div class="collections-actions"><button class="btn btn-ghost" data-action="edit">Edit</button><button class="btn btn-ghost" data-action="preview">Preview</button><button class="btn btn-primary" data-action="share">${group.shareToken ? 'Manage sharing' : 'Share'}</button></div>`}</header>
    ${preview ? '<p class="page-description">Anyone with the link can view and forward it. Certificate details and card photos may already be public.</p>' : '<div class="collections-toolbar"><h2>Cards</h2><button class="btn btn-primary" data-action="add">+ Add cards</button></div>'}
    ${selected.length ? cardGrid(selected, !preview) : '<section class="surface-card collections-empty"><h2>No cards in this collection yet</h2><p>Add cards from My Vault to get started.</p></section>'}`;
}

export function sharedView(group) {
  return `<main class="app-page collections-page"><header class="page-heading"><h1>${esc(group.name)}</h1><p class="page-description">${esc(group.description || '')}</p><p>${group.cards.length} cards</p></header>${group.cards.length ? cardGrid(group.cards) : '<section class="surface-card collections-empty"><h2>No cards in this collection yet</h2></section>'}</main>`;
}
