import {normalizeCertNumber} from '../../_utils/cards.js';
import {error, json, sameOrigin} from '../../_utils/http.js';
import {currentUser} from '../../_utils/sessions.js';

export async function onRequestGet({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const certNumber = normalizeCertNumber(new URL(request.url).searchParams.get('cert'));
  if (!certNumber) return error('Enter 1 to 8 digits for the Cert number.');
  const existing = await env.DB.prepare('SELECT 1 FROM cards WHERE user_id = ? AND cert_number = ? LIMIT 1')
    .bind(session.user.id, certNumber).first();
  return json({certNumber, available: !existing});
}
