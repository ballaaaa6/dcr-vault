import {currentUser} from '../_utils/sessions.js';
import {json, sameOrigin} from '../_utils/http.js';

export async function onRequestPost({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentUser(request, env);
  if (session.response) return session.response;
  const result = await env.DB.prepare(`DELETE FROM vault_celebrations WHERE user_id = ?
    AND EXISTS (SELECT 1 FROM cards WHERE user_id = ?) RETURNING user_id`)
    .bind(session.user.id, session.user.id).first();
  return json({celebrate: Boolean(result)});
}
