// Card item - show only important details: name, set, grade, cert. No price, no full label on Home.
export function cardItem(c){
  const img = c.frontImage || 'https://images.pokemontcg.io/base1/4.png';
  return `<article class="card tilt"><img src="${img}" alt="${c.name}" onerror="this.src='https://images.pokemontcg.io/base1/4.png'"><div class="card-body"><b>${c.name}</b><div class="muted">${c.setName} • ${c.year}</div><div style="margin-top:8px"><span class="badge">Grade: ${c.gradeLabel}</span></div><div class="muted" style="margin-top:6px">Cert: ${c.certNumber}</div><div style="margin-top:10px"><a class="btn btn-ghost" href="#/vault?id=${c.id}" style="padding:8px 12px">View Detail →</a></div></div></article>`;
}
export function listRow(c){
  const img = c.frontImage || 'https://images.pokemontcg.io/base1/4.png';
  return `<a class="list-row" href="#/vault?id=${c.id}"><img src="${img}" alt="${c.name}"><div style="flex:1"><b>${c.name}</b><div class="muted">${c.setName} • ${c.year}</div><div class="muted">Cert: ${c.certNumber}</div></div><span class="badge">${c.gradeLabel}</span><span style="color:var(--dcr-red);font-weight:900">›</span></a>`;
}
