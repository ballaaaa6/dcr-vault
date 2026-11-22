import {normalizeCertNumber} from '../../_utils/cards.js';
import {error, json, requireDatabase} from '../../_utils/http.js';

export async function onRequestGet({env, params}) {
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  const cert = normalizeCertNumber(params.cert);
  if (!cert) return error('Enter 1 to 8 digits for the certificate number.');
  const row = await env.DB.prepare(`SELECT id, cert_number, name, game, set_name, year, card_number,
    rarity, grade_label, source_language, source_finish, catalog_card_id, source_set_id, source_card_id,
    EXISTS(SELECT 1 FROM card_images WHERE card_id = cards.id AND side = 'front') AS has_front,
    EXISTS(SELECT 1 FROM card_images WHERE card_id = cards.id AND side = 'back') AS has_back
    FROM cards WHERE cert_number = ? LIMIT 1`).bind(cert).first();
  if (!row) return json({card: null});
  const image = side => `/api/cards/${encodeURIComponent(row.id)}/images/${side}`;
  return json({card: {certNumber: row.cert_number, name: row.name, game: row.game, setName: row.set_name,
    year: row.year, cardNumber: row.card_number, rarity: row.rarity, gradeLabel: row.grade_label,
    sourceLanguage: row.source_language, sourceFinish: row.source_finish, catalogCardId: row.catalog_card_id,
    sourceSetId: row.source_set_id, sourceCardId: row.source_card_id,
    frontImage: row.has_front ? image('front') : '', backImage: row.has_back ? image('back') : ''}});
}
