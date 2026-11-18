import {cookie, json, sameOrigin} from '../../_utils/http.js';
import {clearSessionCookie, deleteSession} from '../../_utils/sessions.js';

export async function onRequestPost({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  await deleteSession(request, env.DB);
  const response = json({ok: true});
  response.headers.append('Set-Cookie', clearSessionCookie(request));
  response.headers.append('Set-Cookie', cookie('dcr_oauth_nonce', '', request, 0));
  return response;
}
