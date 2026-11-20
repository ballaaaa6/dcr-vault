import {error, json, sameOrigin} from '../../_utils/http.js';
import {IMAGE_MAX_BYTES, readImageBody, supportedImageType} from '../../_utils/images.js';
import {currentUser} from '../../_utils/sessions.js';
import {analyzeWithGemini, MODEL} from '../../_utils/gemini-card-reader.js';

function requestAllowed(request) {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return sameOrigin(request) && (!fetchSite || ['same-origin', 'none'].includes(fetchSite));
}

function geminiFailure(cause) {
  if (cause?.code === 'not_configured') return error('Gemini card reading is not configured for this deployment.', 503);
  if (cause?.code === 'configuration') return error('Gemini API configuration is invalid. Contact the site administrator.', 503);
  if (cause?.code === 'quota') return error('Gemini request quota was reached. Try again later.', 429);
  console.error('Gemini card reading failed.', {model: MODEL, reasonCode: cause?.code || 'unknown'});
  return error('Gemini card reading is temporarily unavailable. Try again in a moment.', 503);
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
  try {
    const fields = await analyzeWithGemini(env, image, contentType);
    if (!fields) return error('Gemini could not read enough card identity details from this image.', 422);
    return json({source: 'gemini', model: MODEL, fields});
  } catch (cause) {
    return geminiFailure(cause);
  }
}
