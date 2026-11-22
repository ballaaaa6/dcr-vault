const statuses = new Set(['in-vault', 'for-sale', 'sold', 'grading']);

function text(value, limit = 160) {
  return String(value ?? '').trim().slice(0, limit);
}

function price(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function normalizeCertNumber(value) {
  const digits = String(value ?? '').trim();
  return /^[0-9]{1,8}$/.test(digits) ? digits.padStart(8, '0') : '';
}

const provenanceFields = ['name', 'setName', 'year', 'cardNumber', 'rarity'];
const provenanceSources = new Set(['unknown', 'user', 'gemini', 'catalog']);

function normalizeProvenance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(provenanceFields.filter(key => provenanceSources.has(value[key]))
    .map(key => [key, value[key]]));
}

function parseProvenance(value) {
  try { return normalizeProvenance(JSON.parse(value || '{}')); } catch { return {}; }
}

export function normalizeCard(input) {
  if (!input || typeof input !== 'object') return null;
  const certNumber = normalizeCertNumber(input.certNumber);
  const name = text(input.name, 120);
  const status = statuses.has(input.status) ? input.status : 'in-vault';
  if (!name || !certNumber) return null;
  return {
    identificationStatus: ['unknown', 'unresolved', 'matched', 'user_selected'].includes(input.identificationStatus) ? input.identificationStatus : 'unknown',
    fieldProvenance: normalizeProvenance(input.fieldProvenance),
    game: text(input.game, 30) || 'other', name, setName: text(input.setName, 120),
    year: text(input.year, 4), yearSeries: text(input.yearSeries, 160),
    catalogCardId: text(input.catalogCardId, 80), sourceLanguage: text(input.sourceLanguage, 20),
    sourceSetId: text(input.sourceSetId, 80), sourceCardId: text(input.sourceCardId, 100),
    sourceFinish: text(input.sourceFinish, 30), cardNumber: text(input.cardNumber, 30), rarity: text(input.rarity, 80),
    gradeLabel: text(input.gradeLabel, 60), artist: text(input.artist, 120), certNumber, status,
    buyPrice: price(input.buyPrice), sellPrice: price(input.sellPrice), buyDate: text(input.buyDate, 20),
    soldDate: text(input.soldDate, 20), boughtFrom: text(input.boughtFrom, 120),
    soldTo: text(input.soldTo, 120), buyCurrency: text(input.buyCurrency, 3) || 'THB',
    purchaseSource: text(input.purchaseSource, 120), seller: text(input.seller, 120), receivedDate: text(input.receivedDate, 10), notes: text(input.notes, 2000)
  };
}

export function cardResponse(row) {
  return {
    identificationStatus: row.identification_status || 'unknown', fieldProvenance: parseProvenance(row.field_provenance),
    id: row.id, game: row.game, name: row.name, setName: row.set_name, year: row.year,
    yearSeries: row.year_series || '', catalogCardId: row.catalog_card_id || '',
    sourceLanguage: row.source_language || '', sourceSetId: row.source_set_id || '',
    sourceCardId: row.source_card_id || '', sourceFinish: row.source_finish || '',
    cardNumber: row.card_number, rarity: row.rarity, gradeLabel: row.grade_label, artist: row.artist || '',
    certNumber: row.cert_number, status: row.status, buyPrice: row.buy_price,
    sellPrice: row.sell_price, buyDate: row.buy_date, soldDate: row.sold_date,
    boughtFrom: row.bought_from, soldTo: row.sold_to, buyCurrency: row.buy_currency || 'THB',
    purchaseSource: row.purchase_source || '', seller: row.seller || '', receivedDate: row.received_date || '', notes: row.notes,
    frontImage: row.front_object_key ? `/api/cards/${encodeURIComponent(row.id)}/images/front` : '',
    backImage: row.back_object_key ? `/api/cards/${encodeURIComponent(row.id)}/images/back` : '',
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export function cardValues(card) {
  return [card.game, card.name, card.setName, card.year, card.yearSeries, card.catalogCardId,
    card.sourceLanguage, card.sourceSetId, card.sourceCardId, card.sourceFinish, card.cardNumber, card.rarity,
    card.gradeLabel, card.certNumber, card.status, card.buyPrice, card.sellPrice,
    card.buyDate, card.soldDate, card.boughtFrom, card.soldTo, card.notes,
    card.identificationStatus, JSON.stringify(card.fieldProvenance), card.artist, card.buyCurrency, card.purchaseSource, card.seller, card.receivedDate];
}
