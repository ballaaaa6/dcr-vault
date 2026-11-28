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

const provenanceFields = ['name', 'setName', 'year', 'cardNumber', 'rarity', 'cardTypeLabel', 'languageLabel', 'series', 'sourceLanguage'];
const provenanceSources = new Set(['unknown', 'user', 'gemini', 'catalog']);

function normalizeProvenance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(provenanceFields.filter(key => provenanceSources.has(value[key]))
    .map(key => [key, value[key]]));
}

function parseProvenance(value) {
  try { return normalizeProvenance(JSON.parse(value || '{}')); } catch { return {}; }
}

function stringList(value, limit = 10) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === 'string').map(item => text(item, 60)).filter(Boolean))].slice(0, limit);
}

function parseList(value) {
  try { return stringList(JSON.parse(value || '[]')); } catch { return []; }
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
    category: text(input.category, 40), pokemonTypes: text(input.pokemonTypes, 120), trainerType: text(input.trainerType, 60),
    colorElements: stringList(input.colorElements), subtypeDetail: text(input.subtypeDetail, 60),
    setNameEn: text(input.setNameEn, 120), setNameLocal: text(input.setNameLocal, 120), setCode: text(input.setCode, 32),
    setNameEnSource: ['printed', 'inferred'].includes(input.setNameEnSource) ? input.setNameEnSource : '',
    setNameLocalSource: ['printed', 'inferred'].includes(input.setNameLocalSource) ? input.setNameLocalSource : '',
    setNameEnType: ['official', 'translation'].includes(input.setNameEnType) ? input.setNameEnType : '',
    releaseYear: text(input.releaseYear, 4), copyrightYear: text(input.copyrightYear, 4), yearSource: ['release', 'copyright', 'user'].includes(input.yearSource) ? input.yearSource : '',
    setSource: ['printed_name', 'printed_code', 'inferred_name'].includes(input.setSource) ? input.setSource : '',
    inferredFields: stringList(input.inferredFields).filter(field => ['series', 'set', 'year', 'rarity'].includes(field)),
    energyKind: text(input.energyKind, 40), energyType: text(input.energyType, 40),
    cardTypeLabel: text(input.cardTypeLabel, 60), languageLabel: text(input.languageLabel, 60), series: text(input.series, 120),
    year: text(input.year, 4), yearSeries: text(input.yearSeries, 160),
    catalogCardId: text(input.catalogCardId, 80), sourceLanguage: text(input.sourceLanguage, 60),
    sourceSetId: text(input.sourceSetId, 80), sourceCardId: text(input.sourceCardId, 100),
    sourceFinish: text(input.sourceFinish, 80), cardNumber: text(input.cardNumber, 30), rarity: text(input.rarity, 80),
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
    category: row.category || '', pokemonTypes: row.pokemon_types || '', trainerType: row.trainer_type || '',
    colorElements: parseList(row.color_elements), subtypeDetail: row.subtype_detail || '',
    setNameEn: row.set_name_en || '', setNameLocal: row.set_name_local || '', setCode: row.set_code || '',
    setNameEnSource: row.set_name_en_source || '', setNameLocalSource: row.set_name_local_source || '',
    setNameEnType: row.set_name_en_type || '', releaseYear: row.release_year || '', copyrightYear: row.copyright_year || '', yearSource: row.year_source || '',
    setSource: row.set_source || '', inferredFields: parseList(row.inferred_fields),
    energyKind: row.energy_kind || '', energyType: row.energy_type || '',
    cardTypeLabel: row.card_type_label || '', languageLabel: row.language_label || '', series: row.series || '',
    yearSeries: row.year_series || '', catalogCardId: row.catalog_card_id || '',
    sourceLanguage: row.source_language || '', sourceSetId: row.source_set_id || '',
    sourceCardId: row.source_card_id || '', sourceFinish: row.source_finish || '',
    cardNumber: row.card_number, rarity: row.rarity, gradeLabel: row.grade_label, artist: row.artist || '',
    certNumber: row.cert_number, status: row.status, buyPrice: row.buy_price,
    sellPrice: row.sell_price, buyDate: row.buy_date, soldDate: row.sold_date,
    boughtFrom: row.bought_from, soldTo: row.sold_to, buyCurrency: row.buy_currency || 'THB',
    purchaseSource: row.purchase_source || '', seller: row.seller || '', receivedDate: row.received_date || '', notes: row.notes,
    storageLocationId: row.storage_location_id || '', storageLocation: row.storage_location || '', position: row.storage_position || '',
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
    card.identificationStatus, JSON.stringify(card.fieldProvenance), card.artist, card.buyCurrency, card.purchaseSource, card.seller, card.receivedDate, card.cardTypeLabel, card.languageLabel, card.series,
    card.category, card.pokemonTypes, card.trainerType, card.energyKind, card.energyType,
    JSON.stringify(card.colorElements), card.subtypeDetail, card.setSource, JSON.stringify(card.inferredFields),
    card.setNameEn, card.setNameLocal, card.setCode, card.setNameEnType, card.releaseYear, card.copyrightYear, card.yearSource, card.setNameEnSource, card.setNameLocalSource];
}
