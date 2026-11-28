import {normalizeCertNumber} from '../../_utils/cards.js';
import {error, json, requireDatabase} from '../../_utils/http.js';
import {vaultBackground} from '../../../src/utils/vault-background.js';

export async function onRequestGet({env, params}) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  const cert = normalizeCertNumber(params.cert);
  if (!cert) return error('Enter 1 to 8 digits for the certificate number.');
  const row = await env.DB.prepare(`SELECT id, cert_number, name, game, set_name, year, card_number,
    rarity, grade_label, card_type_label, language_label, source_language, source_finish,
    category, pokemon_types, trainer_type, energy_kind, color_elements, subtype_detail,
    EXISTS(SELECT 1 FROM card_images WHERE card_id = cards.id AND side = 'front') AS has_front,
    EXISTS(SELECT 1 FROM card_images WHERE card_id = cards.id AND side = 'back') AS has_back
    FROM cards WHERE cert_number = ? LIMIT 1`).bind(cert).first();
  if (!row) return json({card: null});
  const image = side => `/api/cards/${encodeURIComponent(row.id)}/images/${side}`;
  return json({card: {certNumber: row.cert_number, name: row.name, game: row.game, setName: row.set_name,
    year: row.year, cardNumber: row.card_number, rarity: row.rarity, gradeLabel: row.grade_label,
    cardTypeLabel: row.card_type_label, languageLabel: row.language_label,
    sourceLanguage: row.source_language, sourceFinish: row.source_finish,
    category: row.category || '', colorElements: safeColors(row.color_elements), subtypeDetail: row.subtype_detail || '',
    backgroundType: vaultBackground({game: row.game, category: row.category, colorElements: safeColors(row.color_elements), subtypeDetail: row.subtype_detail, pokemonTypes: row.pokemon_types, trainerType: row.trainer_type, energyKind: row.energy_kind}),
    frontImage: row.has_front ? image('front') : '', backImage: row.has_back ? image('back') : ''}});
}

function safeColors(value) {
  try { const result = JSON.parse(value || '[]'); return Array.isArray(result) ? result : []; } catch { return []; }
}
