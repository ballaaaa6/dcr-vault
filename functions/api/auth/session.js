import {json} from '../../_utils/http.js';
import {currentUser} from '../../_utils/sessions.js';

export async function onRequestGet({request, env}) {
  const session = await currentUser(request, env);
  if (session.response?.status === 401) return json({user: null});
  if (session.response) return session.response;
  return json({user: session.user});
}
