import {escapeHTML} from '../utils/format.js';

// Card item - show only important details: name, set, grade, cert. No price, no full label on Home.
export function cardItem(c){
  const img = c.frontImage || 'https://images.pokemontcg.io/base1/4.png';
  return `<article class="card tilt"><img src="${escapeHTML(img)}" alt="${escapeHTML(c.name)}" onerror="this.src='https://images.pokemontcg.io/base1/4.png'"><div class="card-body"><b>${escapeHTML(c.name)}</b><div class="muted">${escapeHTML(c.setName)} • ${escapeHTML(c.year)}</div><div class="card-grade"><span class="badge">Grade: ${escapeHTML(c.gradeLabel)}</span></div><div class="muted card-cert">Cert: ${escapeHTML(c.certNumber)}</div><div class="card-item-action"><a class="btn btn-ghost" href="#/vault?id=${encodeURIComponent(c.id)}">View Detail →</a></div></div></article>`;
}
export function listRow(c){
  const img = c.frontImage || 'https://images.pokemontcg.io/base1/4.png';
  return `<a class="list-row vault-row" href="#/vault?id=${encodeURIComponent(c.id)}"><img src="${escapeHTML(img)}" alt="${escapeHTML(c.name)}"><div class="vault-row-main"><b>${escapeHTML(c.name)}</b><div class="muted">${escapeHTML(c.setName)} • ${escapeHTML(c.year)}</div><div class="muted">Cert: ${escapeHTML(c.certNumber)}</div></div><span class="badge">${escapeHTML(c.gradeLabel)}</span><span class="row-arrow" aria-hidden="true">›</span></a>`;
}
