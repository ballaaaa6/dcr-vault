let catalogPromise;

function normalize(value) {
  return String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase();
}

function numberKey(value) {
  return normalize(value).replace(/^#/, '').replace(/\s+/g, '');
}

async function loadCatalog() {
  catalogPromise ||= fetch('/data/card-catalog.json', {cache: 'force-cache'})
    .then(response => {
      if (!response.ok) throw new Error('Card suggestions are temporarily unavailable.');
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data.cards)) throw new Error('Card catalog format is invalid.');
      return data.cards.map(([id, language, name, setName, year, cardNumber, rarity]) =>
        ({id, language, name, setName, year, cardNumber, rarity}));
    });
  return catalogPromise;
}

function matches(card, filters) {
  return filters.every(([field, query]) => {
    const value = field === 'cardNumber' ? numberKey(card[field]) : normalize(card[field]);
    const needle = field === 'cardNumber' ? numberKey(query) : normalize(query);
    return value.includes(needle);
  });
}

function relevance(card, filters) {
  return filters.reduce((score, [field, query]) => {
    const value = normalize(card[field]);
    const needle = normalize(query);
    return score + (value === needle ? 4 : value.startsWith(needle) ? 2 : 0);
  }, card.language === 'en' ? 1 : 0);
}

export async function findCatalogCandidates(values, limit = 12) {
  const filters = Object.entries(values).filter(([, value]) => String(value ?? '').trim());
  if (!filters.length) return [];
  const cards = await loadCatalog();
  const ordered = cards.filter(card => matches(card, filters))
    .sort((left, right) => relevance(right, filters) - relevance(left, filters)
      || right.year.localeCompare(left.year) || left.name.localeCompare(right.name));
  const seen = new Set();
  return ordered.filter(card => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  }).slice(0, limit);
}
