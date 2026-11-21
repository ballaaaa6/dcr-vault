const aliases = {
  common: 'C', uncommon: 'UC', u: 'UC', rare: 'R', 'holo rare': 'R', 'rare holo': 'R',
  'double rare': 'RR', dr: 'RR', 'triple rare': 'RRR', 'holo rare v': 'RR',
  'holo rare vmax': 'RRR', 'holo rare vstar': 'RRR', 'ultra rare': 'UR',
  'hyper rare': 'HR', 'illustration rare': 'AR', ir: 'AR', 'art rare': 'AR',
  'special illustration rare': 'SAR', sir: 'SAR', 'special art rare': 'SAR',
  'shiny rare': 'S', 'shiny ultra rare': 'SSR', 'character rare': 'CHR',
  'character super rare': 'CSR', 'ace spec rare': 'ACE', 'black white rare': 'BWR',
  'mega attack rare': 'MA', 'mega hyper rare': 'MUR', 'mega ultra rare': 'MUR',
  'futuristic rare': 'FUR', promo: 'Promo', promotional: 'Promo', p: 'Promo'
};

export function formatRarity(value) {
  const raw = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (['none', 'null', 'undefined'].includes(raw.toLowerCase())) return '';
  return aliases[raw.toLowerCase()] || raw;
}
