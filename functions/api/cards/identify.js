import {error, json, sameOrigin} from '../../_utils/http.js';
import {IMAGE_MAX_BYTES, readImageBody, supportedImageType} from '../../_utils/images.js';
import {currentUser} from '../../_utils/sessions.js';
import {analyzeWithGemini, MODEL} from '../../_utils/gemini-card-reader.js';
import {analyzeWithZai, ZAI_MODEL} from '../../_utils/zai-card-reader.js';
import {safeRecordIdentification} from '../../_utils/identification-log.js';

function requestAllowed(request) {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return sameOrigin(request) && (!fetchSite || ['same-origin', 'none'].includes(fetchSite));
}

function geminiFailure(cause, requestId, model) {
  const failures = {
    not_configured: ['Card reading is not configured for this deployment.', 503, 'gemini_not_configured'],
    configuration: ['Card reading configuration is invalid. Contact the site administrator.', 503, 'gemini_configuration'],
    quota: ['Card reading request quota was reached. Try again later.', 429, 'gemini_quota'],
    timeout: ['Card reading timed out. Try again.', 503, 'gemini_timeout'],
    network_error: ['Card reading could not be reached. Try again.', 503, 'gemini_network'],
    upstream: ['Card reading is temporarily unavailable. Try again in a moment.', 503, 'gemini_upstream']
  };
  const [message, status, code] = failures[cause?.code] || [
    'Card reading is temporarily unavailable. Try again in a moment.', 503, 'gemini_unknown'
  ];
  console.error('Card reading failed.', {model, requestId, reasonCode: cause?.code || 'unknown',
    upstreamStatus: cause?.upstreamStatus || null, failureDiagnostics: cause?.diagnostics || null});
  return json({error: message, code, requestId}, status);
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
  const provider = env.CARD_READER_PROVIDER === 'zai' ? 'zai' : 'gemini';
  const model = provider === 'zai' ? ZAI_MODEL : MODEL;
  return identifyCard(image.body, contentType, env, session.user.id, model, provider);
}

async function identifyCard(image, contentType, env, userId, model, provider) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let fields;
  let rawReading;
  let failure;
  try {
    const analyze = provider === 'zai' ? analyzeWithZai : analyzeWithGemini;
    fields = await analyze(env, image, contentType, requestId, value => { rawReading = value; }, model);
  } catch (cause) { failure = cause; }
  await safeRecordIdentification(env.DB, userId, {requestId, model, durationMs: Date.now() - startedAt,
    outcome: failure?.code || (fields ? 'success' : 'unreadable'), reading: {raw: safeRawReading(rawReading), normalized: safeRawReading(fields)}});
  if (failure) return geminiFailure(failure, requestId, model);
  if (!fields) return json({error: 'The card reader could not identify this card from the image.',
    code: 'card_unreadable', requestId}, 422);
  return json({source: provider, model, fields,
    readingAdequate: true, requestId});
}

function safeRawReading(value) {
  const keys = ['game', 'set', 'set_source', 'card_number', 'color_element', 'subtype_detail', 'inferred_fields', 'setSource', 'colorElements', 'subtypeDetail', 'inferredFields', 'cardTypeLabel', 'languageLabel', 'series', 'category', 'trainerType', 'energyKind', 'energyType', 'formName', 'formSetName', 'formYear', 'formCardNumber', 'formRarity', 'name', 'englishName', 'setName', 'englishSetName', 'setCode', 'cardNumber', 'language', 'year',
    'rarity', 'hp', 'illustrator', 'types', 'stamp', 'setSymbol', 'copyrightText', 'identificationSummary', 'identityStatus', 'evidence', 'uncertainFields'];
  if (!value || typeof value !== 'object') return {};
  const form = value.form && typeof value.form === 'object' ? Object.fromEntries(
    Object.entries(value.form).filter(([, item]) => typeof item === 'string').map(([key, item]) => [key, item.slice(0, 300)])) : undefined;
  return {...(form ? {form} : {}), ...Object.fromEntries(keys.filter(key => typeof value[key] === 'string' || Array.isArray(value[key]))
    .map(key => [key, Array.isArray(value[key]) ? value[key].filter(item => typeof item === 'string').slice(0, 12).map(item => item.slice(0, 300)) : value[key].slice(0, 300)]))};
}
