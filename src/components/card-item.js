import {escapeHTML} from '../utils/format.js';
import {vaultBackground} from '../utils/vault-background.js';
import {cardImageVariant} from '../utils/card-image-variant.js';

export function listRow(c){
  const image = `<span class="vault-row-image">${vaultImage(c, 'card-image-placeholder', 'No photo')}</span>`;
  const prefetch = cardImageVariant(c.referenceImage || c.frontImage, 'medium');
  return `<button type="button" class="list-row vault-row" data-prefetch-image="${escapeHTML(prefetch)}" data-vault-art="${vaultBackground(c)}" data-card-id="${escapeHTML(c.id)}" onclick="window.__selectVault(this.dataset.cardId)">${image}<div class="vault-row-main"><b>${escapeHTML(c.name)}</b><div class="muted">${escapeHTML(c.setName)} • ${escapeHTML(c.year)}</div><div class="muted">Cert: ${escapeHTML(c.certNumber)}</div></div><span class="badge">${escapeHTML(c.gradeLabel)}</span><span class="row-arrow" aria-hidden="true">›</span></button>`;
}

export function vaultImage(card, placeholderClass, placeholderText, imageClass = '') {
  const sources = [card.referenceImage, card.frontImage].filter(Boolean).map(url => cardImageVariant(url, 'small'));
  const image = sources.length ? `<img class="${imageClass}" src="${escapeHTML(sources[0])}" data-fallback="${escapeHTML(sources[1] || '')}" alt="${escapeHTML(card.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else{this.hidden=true;this.nextElementSibling.hidden=false}">` : '';
  return `${image}<span class="${placeholderClass}"${sources.length ? ' hidden' : ''}>${placeholderText}</span>`;
}
