import {error, json, sameOrigin} from '../../_utils/http.js';
import {IMAGE_MAX_BYTES, readImageBody, supportedImageType} from '../../_utils/images.js';
import {currentUser} from '../../_utils/sessions.js';
import {analyzeWithGemma, cleanReading, cleanText, MODEL} from '../../_utils/gemma-card-reader.js';
import {identifyWithOracle, resolveWithOracle} from '../../_utils/oracle-card-reading.js';

function selectedSummary(result) {
  return result?.selected?.summary || result?.selected || null;
}

function fieldsFromScan(scan, selected) {
  const keys = scan?.keys || {};
  const summary = selectedSummary(selected) || {};
  const year = cleanText(keys.year || summary.release_date, 12).match(/(?:19|20)\d{2}/)?.[0] || '';
  const attacks = Array.isArray(keys.attacks) ? keys.attacks : (summary.attack_names || []).map(name => ({name}));
  return cleanReading({
    name: keys.name || summary.name, setName: keys.set_name || summary.set_name,
    englishName: keys.english_name, englishSetName: keys.english_set_name,
    year, cardNumber: keys.collector_number || keys.local_id || summary.local_id,
    language: keys.language || summary.language, rarity: keys.rarity || summary.rarity,
    hp: keys.hp || summary.hp, illustrator: keys.illustrator || summary.illustrator, stage: keys.stage || summary.stage,
    types: keys.types || summary.types, attacks, abilities: keys.ability_names || summary.ability_names,
    weaknesses: keys.weaknesses, resistances: keys.resistances, retreat: keys.retreat,
    evolvesFrom: keys.evolves_from, confidence: {
      name: scan?.confidence?.name, setName: scan?.confidence?.set_name,
      cardNumber: scan?.confidence?.collector_number, language: scan?.confidence?.language,
      hp: scan?.confidence?.hp, illustrator: scan?.confidence?.illustrator, stage: scan?.confidence?.stage,
      types: scan?.confidence?.types, attacks: scan?.confidence?.attacks, abilities: scan?.confidence?.ability_names
    }
  });
}

function combineReadings(ocr, gemma) {
  if (!gemma) return ocr;
  if (!ocr) return gemma;
  const output = {...ocr};
  const confidenceKeys = {name: 'name', setName: 'set_name', cardNumber: 'collector_number', language: 'language',
    rarity: 'rarity', hp: 'hp', illustrator: 'illustrator', stage: 'stage', types: 'types', attacks: 'attacks',
    abilities: 'ability_names', weaknesses: 'weaknesses', resistances: 'resistances', retreat: 'retreat', evolvesFrom: 'evolves_from'};
  for (const [field, key] of Object.entries(confidenceKeys)) {
    if (gemma[field] === '' || gemma[field] === undefined || Array.isArray(gemma[field]) && !gemma[field].length) continue;
    const scanned = Number(ocr.fieldConfidence?.[field] || 0);
    if (!output[field] || Array.isArray(output[field]) && !output[field].length || field === 'language' && output[field] === 'en'
        || scanned < 0.8 && Number(gemma.fieldConfidence?.[field] || 0.75) > scanned) output[field] = gemma[field];
  }
  for (const field of ['englishName', 'englishSetName', 'year']) if (gemma[field]) output[field] = gemma[field];
  output.fieldConfidence = {...(ocr.fieldConfidence || {}), ...(gemma.fieldConfidence || {})};
  return cleanReading(output);
}

function hasResolvableIdentity(scan, fields) {
  const keys = scan?.keys || {};
  return Boolean((keys.name || fields?.name) && (keys.collector_number || fields?.cardNumber) && (keys.language || fields?.language));
}

function pipelineSummary(initial, resolved) {
  const final = resolved || initial;
  return {
    status: final?.status || initial?.status || 'unavailable',
    initialStatus: initial?.status || 'unavailable',
    reason: final?.reason || initial?.reason || '',
    blockers: initial?.blockers || [],
    selected: selectedSummary(final),
    candidates: final?.candidates || initial?.candidates || []
  };
}

function requestAllowed(request) {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return sameOrigin(request) && (!fetchSite || ['same-origin', 'none'].includes(fetchSite));
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
  const initial = await identifyWithOracle(env, image.body, contentType);
  if (initial?.status === 'matched_preview' && initial.selected) {
    return json({source: 'ocr', fields: fieldsFromScan(initial.scanKeys, initial.selected), pipeline: pipelineSummary(initial)});
  }
  if (!env.AI?.run) {
    const partial = fieldsFromScan(initial?.scanKeys, null);
    if (partial) return json({source: 'ocr', fields: partial, pipeline: pipelineSummary(initial)});
    return error('Neither the Oracle OCR service nor Gemma is configured for this deployment.', 503);
  }
  let fields;
  try {
    fields = await analyzeWithGemma(env, image.body, contentType);
  } catch (cause) {
    console.error('Card image analysis failed.', {model: MODEL, message: cause instanceof Error ? cause.message : String(cause)});
    return error('Gemma image analysis is temporarily unavailable. You can enter the details manually.', 503);
  }
  if (!fields) {
    const partial = fieldsFromScan(initial?.scanKeys, null);
    if (partial) return json({source: 'ocr', fields: partial, pipeline: pipelineSummary(initial)});
    return error('Gemma could not read card identity details from this image.', 502);
  }
  const resolved = initial?.scanKeys && hasResolvableIdentity(initial.scanKeys, fields)
    ? await resolveWithOracle(env, initial.scanKeys, fields) : null;
  const finalScan = resolved?.scanKeys || initial?.scanKeys;
  const scannedFields = fieldsFromScan(finalScan, resolved?.selected || initial?.selected);
  return json({
    model: MODEL,
    source: resolved?.status === 'matched_preview' ? 'ocr+gemma' : 'gemma_fallback',
    fields: combineReadings(scannedFields, fields),
    pipeline: pipelineSummary(initial, resolved)
  });
}
