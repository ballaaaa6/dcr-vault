import {normalizeCert} from '../utils/cert.js';

async function requestJson(path, options = {}) {
  const response = await fetch(path, {credentials: 'same-origin', ...options});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Card data could not be loaded.');
    error.status = response.status;
    throw error;
  }
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

export function checkCert(cert) {
  return requestJson(`/api/cards/cert-check?cert=${encodeURIComponent(cert)}`);
}

export async function uploadCardImage(id, side, file) {
  return requestJson(`/api/cards/${encodeURIComponent(id)}/images/${side}`, {
    method: 'PUT', headers: {'Content-Type': file.type}, body: file
  });
}

export async function deleteCardImage(id, side) {
  return requestJson(`/api/cards/${encodeURIComponent(id)}/images/${side}`, {method: 'DELETE'});
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
  const normalized = normalizeCert(cert);
  return normalized ? cards.find(card => normalizeCert(card.certNumber) === normalized) : undefined;
}
