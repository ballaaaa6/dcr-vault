const pokemonTypes = new Set(['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'fairy', 'dragon', 'colorless']);
const trainerTypes = {'item': 'item', 'supporter': 'supporter', 'stadium': 'stadium', 'pokemon tool': 'pokemon-tool'};

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function vaultBackground(card = {}) {
  const category = normalize(card.category);
  if (category === 'pokemon') {
    const type = normalize(String(card.pokemonTypes || '').split(',')[0]);
    return pokemonTypes.has(type) ? type : 'unknown';
  }
  if (category === 'trainer') return trainerTypes[normalize(card.trainerType)] || 'unknown';
  if (category === 'energy') {
    const kind = normalize(card.energyKind);
    return kind === 'basic' || kind === 'special' ? `${kind}-energy` : 'unknown';
  }
  return 'unknown';
}
