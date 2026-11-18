import {cookie, json, sameOrigin} from '../../_utils/http.js';

export async function onRequestGet({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const nonce = crypto.randomUUID();
  return json({clientId: env.GOOGLE_CLIENT_ID || '', nonce}, 200, {
    'Set-Cookie': cookie('dcr_oauth_nonce', nonce, request, 300)
  });
}
