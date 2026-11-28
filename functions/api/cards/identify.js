import {formatFirstEdition} from '../../../src/utils/first-edition.js';
import {error, json, sameOrigin} from '../../_utils/http.js';
import {IMAGE_MAX_BYTES, readImageBody, supportedImageType} from '../../_utils/images.js';
import {currentUser} from '../../_utils/sessions.js';
import {analyzeWithGemini, reviewWithGemini, MODEL} from '../../_utils/gemini-card-reader.js';
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
  let contentType, image, details = null;
  if ((request.headers.get('content-type') || '').startsWith('multipart/form-data')) {
    if (Number(request.headers.get('content-length') || 0) > IMAGE_MAX_BYTES + 16384) return error('Each photo must be 10 MB or smaller.', 413);
    let form;
    try {
      const reader = request.body?.getReader();
      if (!reader) return error('Invalid review request.');
      const chunks = []; let size = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.length;
        if (size > IMAGE_MAX_BYTES + 16384) { await reader.cancel(); return error('Each photo must be 10 MB or smaller.', 413); }
        chunks.push(value);
      }
      form = await new Request(request.url, {method: 'POST', headers: {'Content-Type': request.headers.get('content-type')}, body: new Blob(chunks)}).formData();
    } catch { return error('Invalid review request.'); }
    const file = form.get('image');
    contentType = supportedImageType(file?.type);
    const raw = form.get('details');
    if (!contentType || !file?.size || file.size > IMAGE_MAX_BYTES || typeof raw !== 'string' || raw.length > 5000) return error('Invalid review request.');
    try { details = JSON.parse(raw); } catch { return error('Invalid review details.'); }
    if (!details || typeof details !== 'object' || Array.isArray(details)) return error('Invalid review details.');
    const allowed = ['game', 'language', 'year', 'setName', 'cardNumber', 'name', 'rarity', 'category', 'subtypeDetail'];
    details = Object.fromEntries(allowed.map(key => [key, typeof details[key] === 'string' ? details[key].slice(0, 120) : '']).concat([['colorElements', Array.isArray(details.colorElements) ? details.colorElements.filter(v => typeof v === 'string').slice(0, 10).map(v => v.slice(0, 40)) : []]]));
    image = {body: new Uint8Array(await file.arrayBuffer())};
  } else {
    contentType = supportedImageType(request.headers.get('content-type'));
    if (!contentType) return error('Choose a JPEG, PNG, or WebP front image.');
    image = await readImageBody(request);
    if (image.error) return error(image.error, image.error.includes('10 MB') ? 413 : 400);
  }
  return identifyWithGemini(image.body, contentType, env, session.user.id, MODEL, details);
}

async function identifyWithGemini(image, contentType, env, userId, model, details = null) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let fields;
  let rawReading;
  let review;
  let failure;
  try {
    if (details) {
      const result = await reviewWithGemini(env, image, contentType, requestId, details, model);
      fields = result.fields; rawReading = result.parsed;
    } else fields = await analyzeWithGemini(env, image, contentType, requestId, (value, info) => { rawReading = value; review = info; }, model);
  } catch (cause) { failure = cause; }
  await safeRecordIdentification(env.DB, userId, {requestId, model, durationMs: Date.now() - startedAt,
    outcome: failure?.code || (fields ? 'success' : 'unreadable'), reading: {raw: safeRawReading(rawReading), normalized: safeRawReading(fields),
      fieldStates: readingFieldStates(rawReading, fields, failure), ...(review ? {review: {initial: safeRawReading(review.initial), retryOutcome: review.retryOutcome, missingBefore: review.missingBefore, missingAfter: review.missingAfter}} : {})}});
  if (fields) fields.setName = formatFirstEdition(fields.setName, fields.hasFirstEdition);
  if (failure) return geminiFailure(failure, requestId, model);
  if (!fields) return json({error: 'Gemini could not identify this card from the image.',
    code: 'card_unreadable', requestId}, 422);
  return json({source: 'gemini', model, fields,
    readingAdequate: true, requestId});
}

function readingFieldStates(raw, fields, failure) {
  if (failure || !raw) return Object.fromEntries(['year', 'setName'].map(key => [key, failure ? 'request_failed' : 'no_reading']));
  const status = (source, result) => result ? 'returned' : source ? 'invalid_format' : 'empty_from_model';
  return {year: status(raw.release_year, fields?.year),
    setName: status(raw.set_name, fields?.setName)};
}

function safeRawReading(value) {
  const keys = ['set_name', 'set_name_en', 'set_name_local', 'set_name_en_source', 'set_name_local_source', 'setNameEnSource', 'setNameLocalSource', 'set_code', 'set_name_en_type', 'release_year', 'copyright_year', 'setNameEn', 'setNameLocal', 'setNameEnType', 'releaseYear', 'copyrightYear', 'yearSource', 'game', 'set', 'set_source', 'card_number', 'color_element', 'subtype_detail', 'inferred_fields', 'setSource', 'colorElements', 'subtypeDetail', 'inferredFields', 'cardTypeLabel', 'languageLabel', 'series', 'category', 'trainerType', 'energyKind', 'energyType', 'formName', 'formSetName', 'formYear', 'formCardNumber', 'formRarity', 'name', 'englishName', 'setName', 'englishSetName', 'setCode', 'cardNumber', 'language', 'year',
    'rarity', 'hp', 'illustrator', 'types', 'stamp', 'setSymbol', 'copyrightText', 'identificationSummary', 'identityStatus', 'evidence', 'uncertainFields',
    'set_missing_reason'];
  if (!value || typeof value !== 'object') return {};
  const form = value.form && typeof value.form === 'object' ? Object.fromEntries(
    Object.entries(value.form).filter(([, item]) => typeof item === 'string').map(([key, item]) => [key, item.slice(0, 300)])) : undefined;
  return {...(form ? {form} : {}), ...Object.fromEntries(keys.filter(key => typeof value[key] === 'string' || Array.isArray(value[key]))
    .map(key => [key, Array.isArray(value[key]) ? value[key].filter(item => typeof item === 'string').slice(0, 12).map(item => item.slice(0, 300)) : value[key].slice(0, 300)]))};
}
