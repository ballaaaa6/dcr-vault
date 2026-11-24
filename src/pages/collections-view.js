import {escapeHTML as esc} from '../utils/format.js';
import {vaultImage} from '../components/card-item.js';
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

export function listView(groups, cards) {
  return `<header class="page-heading collections-heading"><div><h1>Collections</h1><p class="page-description">Organize your cards and share the ones you choose.</p></div><button class="btn btn-primary" data-action="create">Create collection</button></header>
    ${groups.length ? `<div class="collections-list">${groups.map(group => {
      const cover = cards.find(card => group.cardIds.includes(card.id));
      return `<button type="button" class="surface-card collections-item" data-open="${esc(group.id)}"><span class="collections-cover">${cover ? vaultImage(cover, 'collection-photo-empty', 'No photo') : '<span class="collection-photo-empty">No cards yet</span>'}</span><span><strong>${esc(group.name)}</strong><small>${group.cardIds.length} cards · ${group.shareToken ? 'Shared by link' : 'Private'}</small></span><span aria-hidden="true">›</span></button>`;
    }).join('')}</div>` : `<section class="surface-card collections-empty"><h2>Create your first collection</h2><p>Choose cards from My Vault to make a collection. Keep it private or share it when you are ready.</p><button class="btn btn-primary" data-action="create">Create collection</button></section>`}`;
}

export function detailView(group, cards, preview = false) {
  const selected = group.cardIds.map(id => cards.find(card => card.id === id)).filter(Boolean).map(card => preview ? {...card, referenceImage: ''} : card);
  return `<button class="btn btn-ghost" data-action="back">← Collections</button><header class="page-heading collections-heading"><div><p class="collection-status">${preview ? 'Share preview' : group.shareToken ? 'Shared by link' : 'Private'}</p><h1>${esc(group.name)}</h1><p class="page-description">${esc(group.description || '')}</p><p>${selected.length} cards</p></div>${preview ? '<button class="btn btn-ghost" data-action="preview">Close preview</button>' : `<div class="collections-actions"><button class="btn btn-ghost" data-action="edit">Edit</button><button class="btn btn-ghost" data-action="preview">Preview</button><button class="btn btn-primary" data-action="share">${group.shareToken ? 'Manage sharing' : 'Share'}</button></div>`}</header>
    ${preview ? '<p class="page-description">Anyone with the link can view and forward it. Certificate details and card photos may already be public.</p>' : '<div class="collections-toolbar"><h2>Cards</h2><button class="btn btn-ghost" data-action="add">Add cards</button></div>'}
    ${selected.length ? cardGrid(selected, !preview) : '<section class="surface-card collections-empty"><h2>No cards in this collection yet</h2><p>Add cards from My Vault to get started.</p></section>'}`;
}

export function sharedView(group) {
  return `<main class="app-page collections-page"><header class="page-heading"><h1>${esc(group.name)}</h1><p class="page-description">${esc(group.description || '')}</p><p>${group.cards.length} cards</p></header>${group.cards.length ? cardGrid(group.cards) : '<section class="surface-card collections-empty"><h2>No cards in this collection yet</h2></section>'}</main>`;
}
