import {escapeHTML} from '../utils/format.js';

export function listRow(c){
  const image = `<span class="vault-row-image">${vaultImage(c, 'card-image-placeholder', 'No photo')}</span>`;
  return `<button type="button" class="list-row vault-row" data-card-id="${escapeHTML(c.id)}" onclick="window.__selectVault(this.dataset.cardId)">${image}<div class="vault-row-main"><b>${escapeHTML(c.name)}</b><div class="muted">${escapeHTML(c.setName)} • ${escapeHTML(c.year)}</div><div class="muted">Cert: ${escapeHTML(c.certNumber)}</div></div><span class="badge">${escapeHTML(c.gradeLabel)}</span><span class="row-arrow" aria-hidden="true">›</span></button>`;
}

export function vaultImage(card, placeholderClass, placeholderText, imageClass = '') {
  const sources = [card.referenceImage, card.frontImage].filter(Boolean);
  const image = sources.length ? `<img class="${imageClass}" src="${escapeHTML(sources[0])}" data-fallback="${escapeHTML(sources[1] || '')}" alt="${escapeHTML(card.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else{this.hidden=true;this.nextElementSibling.hidden=false}">` : '';
  return `${image}<span class="${placeholderClass}"${sources.length ? ' hidden' : ''}>${placeholderText}</span>`;
}
