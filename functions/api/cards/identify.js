import {error, json, sameOrigin} from '../../_utils/http.js';
import {IMAGE_MAX_BYTES, readImageBody, supportedImageType} from '../../_utils/images.js';
import {currentUser} from '../../_utils/sessions.js';
import {analyzeWithGemini, cleanReading, cleanText, MODEL} from '../../_utils/gemini-card-reader.js';
import {identifyWithOracle} from '../../_utils/oracle-card-reading.js';

function requestAllowed(request) {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return sameOrigin(request) && (!fetchSite || ['same-origin', 'none'].includes(fetchSite));
}

function geminiFailure(cause, requestId, oracleResult) {
  const failures = {
    not_configured: ['Gemini card reading is not configured for this deployment.', 503, 'gemini_not_configured'],
    configuration: ['Gemini API configuration is invalid. Contact the site administrator.', 503, 'gemini_configuration'],
    quota: ['Gemini request quota was reached. Try again later.', 429, 'gemini_quota'],
    timeout: ['Gemini card reading timed out. Try again.', 503, 'gemini_timeout'],
    network_error: ['Gemini could not be reached. Try again.', 503, 'gemini_network'],
    upstream: ['Gemini card reading is temporarily unavailable. Try again in a moment.', 503, 'gemini_upstream']
  };
  const [message, status, code] = failures[cause?.code] || [
    'Gemini card reading is temporarily unavailable. Try again in a moment.', 503, 'gemini_unknown'
  ];
  console.error('Gemini card reading failed.', {model: MODEL, requestId, reasonCode: cause?.code || 'unknown',
    upstreamStatus: cause?.upstreamStatus || null, failureDiagnostics: cause?.diagnostics || null,
    oracleStatus: oracleResult?.status || 'unavailable', oracleReasonCode: oracleResult?.reasonCode || null,
    oracleUpstreamStatus: oracleResult?.upstreamStatus || null});
  return json({error: message, code, requestId}, status);
}

function selectedSummary(result) {
  return result?.selected?.summary || result?.selected || {};
}

function fieldsFromOracle(result) {
  const scan = result?.scanKeys || {};
  const keys = scan.keys || {};
  const summary = selectedSummary(result);
  const year = cleanText(keys.year || summary.release_date, 12).match(/(?:19|20)\d{2}/)?.[0] || '';
  const attacks = Array.isArray(keys.attacks) ? keys.attacks : (summary.attack_names || []).map(name => ({name}));
  return cleanReading({
    name: keys.name || summary.name, setName: keys.set_name || summary.set_name,
    englishName: keys.english_name, englishSetName: keys.english_set_name, year,
    cardNumber: keys.collector_number || keys.local_id || summary.local_id,
    language: keys.language || summary.language, rarity: keys.rarity || summary.rarity,
    hp: keys.hp || summary.hp, illustrator: keys.illustrator || summary.illustrator,
    stage: keys.stage || summary.stage, types: keys.types || summary.types, attacks,
    abilities: keys.ability_names || summary.ability_names, weaknesses: keys.weaknesses,
    resistances: keys.resistances, retreat: keys.retreat, evolvesFrom: keys.evolves_from,
    confidence: {name: scan.confidence?.name, setName: scan.confidence?.set_name,
      cardNumber: scan.confidence?.collector_number, language: scan.confidence?.language,
      hp: scan.confidence?.hp, illustrator: scan.confidence?.illustrator,
      stage: scan.confidence?.stage, types: scan.confidence?.types,
      attacks: scan.confidence?.attacks, abilities: scan.confidence?.ability_names}
  });
}

export async function onRequestPost({request, env}) {
  if (!requestAllowed(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const contentType = supportedImageType(request.headers.get('content-type'));
  if (!contentType) return error('Choose a JPEG, PNG, or WebP front image.');
  const image = await readImageBody(request);
  if (image.error) return error(image.error, image.error.includes('10 MB') ? 413 : 400);
  if (image.body.byteLength > IMAGE_MAX_BYTES) return error('Each photo must be 10 MB or smaller.', 413);
  return identifyWithGemini(image.body, contentType, env);
}

async function identifyWithGemini(image, contentType, env) {
  const requestId = crypto.randomUUID();
  let fields;
  let failure;
  try {
    fields = await analyzeWithGemini(env, image, contentType, requestId);
  } catch (cause) { failure = cause; }
  if (fields) return json({source: 'gemini', model: MODEL, fields});

  const oracleResult = await identifyWithOracle(env, image, contentType, requestId);
  const oracleFields = fieldsFromOracle(oracleResult);
  if (oracleFields) {
    console.warn('Card identification used Oracle OCR fallback.', {requestId,
      geminiReasonCode: failure?.code || 'unreadable', oracleStatus: oracleResult?.status || 'unknown'});
    return json({source: 'oracle_ocr', fields: oracleFields});
  }
  if (failure) return geminiFailure(failure, requestId, oracleResult);
  return json({error: 'Gemini and OCR could not read enough card identity details from this image.',
    code: 'card_unreadable', requestId}, 422);
}
