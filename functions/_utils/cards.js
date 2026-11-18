const statuses = new Set(['in-vault', 'for-sale', 'sold', 'grading']);

function text(value, limit = 160) {
  return String(value ?? '').trim().slice(0, limit);
}

function price(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function normalizeCard(input) {
  if (!input || typeof input !== 'object') return null;
  const certNumber = text(input.certNumber, 8);
  const name = text(input.name, 120);
  const status = statuses.has(input.status) ? input.status : 'in-vault';
  if (!name || !/^[0-9]{8}$/.test(certNumber)) return null;
  return {
    game: text(input.game, 30) || 'other', name, setName: text(input.setName, 120),
    year: text(input.year, 4), cardNumber: text(input.cardNumber, 30), rarity: text(input.rarity, 40),
    gradeLabel: text(input.gradeLabel, 60), certNumber, status,
    buyPrice: price(input.buyPrice), sellPrice: price(input.sellPrice), buyDate: text(input.buyDate, 20),
    soldDate: text(input.soldDate, 20), boughtFrom: text(input.boughtFrom, 120),
    soldTo: text(input.soldTo, 120), notes: text(input.notes, 2000)
  };
}

export function cardResponse(row) {
  return {
    id: row.id, game: row.game, name: row.name, setName: row.set_name, year: row.year,
    cardNumber: row.card_number, rarity: row.rarity, gradeLabel: row.grade_label,
    certNumber: row.cert_number, status: row.status, buyPrice: row.buy_price,
    sellPrice: row.sell_price, buyDate: row.buy_date, soldDate: row.sold_date,
    boughtFrom: row.bought_from, soldTo: row.sold_to, notes: row.notes,
    frontImage: '', backImage: '', createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export function cardValues(card) {
  return [card.game, card.name, card.setName, card.year, card.cardNumber, card.rarity,
    card.gradeLabel, card.certNumber, card.status, card.buyPrice, card.sellPrice,
    card.buyDate, card.soldDate, card.boughtFrom, card.soldTo, card.notes];
}
