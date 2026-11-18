async function requestJson(path, options = {}) {
  const response = await fetch(path, {credentials: 'same-origin', ...options});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Card data could not be loaded.');
  return result;
}

export async function getCards() {
  const result = await requestJson('/api/cards');
  return result.cards || [];
}

export async function addCard(card) {
  const result = await requestJson('/api/cards', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(card)
  });
  return result.card;
}

export async function updateCard(id, patch) {
  return requestJson(`/api/cards/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(patch)
  });
}

export async function importCards(cards) {
  return requestJson('/api/cards/import', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({cards})
  });
}

export function findByCert(cards, cert) {
  return cards.find(card => String(card.certNumber) === String(cert).trim());
}
