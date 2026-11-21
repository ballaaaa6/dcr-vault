import {escapeHTML} from '../utils/format.js';

// Card item - show only important details: name, set, grade, cert. No price, no full label on Home.
export function cardItem(c){
  const image = c.frontImage ? `<img src="${escapeHTML(c.frontImage)}" alt="${escapeHTML(c.name)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="card-image-placeholder" hidden>No front photo</div>` : '<div class="card-image-placeholder">No front photo</div>';
  return `<article class="card tilt">${image}<div class="card-body"><b>${escapeHTML(c.name)}</b><div class="muted">${escapeHTML(c.setName)} • ${escapeHTML(c.year)}</div><div class="card-grade"><span class="badge">Grade: ${escapeHTML(c.gradeLabel)}</span></div><div class="muted card-cert">Cert: ${escapeHTML(c.certNumber)}</div><div class="card-item-action"><a class="btn btn-ghost" href="#/vault?id=${encodeURIComponent(c.id)}">View Detail →</a></div></div></article>`;
}
export function listRow(c){
  const image = `<span class="vault-row-image">${vaultImage(c, 'card-image-placeholder', 'No photo')}</span>`;
  return `<a class="list-row vault-row" href="#/vault?id=${encodeURIComponent(c.id)}">${image}<div class="vault-row-main"><b>${escapeHTML(c.name)}</b><div class="muted">${escapeHTML(c.setName)} • ${escapeHTML(c.year)}</div><div class="muted">Cert: ${escapeHTML(c.certNumber)}</div></div><span class="badge">${escapeHTML(c.gradeLabel)}</span><span class="row-arrow" aria-hidden="true">›</span></a>`;
}

export function vaultImage(card, placeholderClass, placeholderText, imageClass = '') {
  const sources = [card.referenceImage, card.frontImage].filter(Boolean);
  const image = sources.length ? `<img class="${imageClass}" src="${escapeHTML(sources[0])}" data-fallback="${escapeHTML(sources[1] || '')}" alt="${escapeHTML(card.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else{this.hidden=true;this.nextElementSibling.hidden=false}">` : '';
  return `${image}<span class="${placeholderClass}"${sources.length ? ' hidden' : ''}>${placeholderText}</span>`;
}
