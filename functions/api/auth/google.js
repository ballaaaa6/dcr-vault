import {cookie, cookieValue, json, readJson, requireDatabase, sameOrigin} from '../../_utils/http.js';
import {verifyGoogleCredential} from '../../_utils/google.js';
import {createSession, sessionCookie} from '../../_utils/sessions.js';

export async function onRequestPost({request, env}) {
  if (!sameOrigin(request)) return json({error: 'Invalid request origin.'}, 403);
  const unavailable = requireDatabase(env);
  if (unavailable) return unavailable;
  if (!env.GOOGLE_CLIENT_ID) return json({error: 'Google sign-in is not configured.'}, 503);
  const body = await readJson(request);
  const expectedNonce = cookieValue(request, 'dcr_oauth_nonce');
  if (!body?.credential || !expectedNonce) return json({error: 'Google sign-in expired. Try again.'}, 400);
  let claims;
  try {
    claims = await verifyGoogleCredential(body.credential, env.GOOGLE_CLIENT_ID, expectedNonce);
  } catch {
    return json({error: 'Google sign-in could not be verified. Try again.'}, 401);
  }
  try { return await establishSession(claims, request, env); }
  catch { return json({error: 'Your account could not be created right now.'}, 503); }
}

async function establishSession(claims, request, env) {
  const now = Math.floor(Date.now() / 1000);
  const user = await env.DB.prepare(`INSERT INTO users (id, google_sub, email, display_name, avatar_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email,
    display_name = excluded.display_name, avatar_url = excluded.avatar_url, updated_at = excluded.updated_at
    RETURNING id`)
    .bind(crypto.randomUUID(), claims.sub, claims.email, claims.name || '', claims.picture || '', now, now).first();
  const token = await createSession(env.DB, user.id);
  const response = json({user: {id: user.id, email: claims.email, displayName: claims.name || '', avatarUrl: claims.picture || ''}});
  response.headers.append('Set-Cookie', sessionCookie(token, request));
  response.headers.append('Set-Cookie', cookie('dcr_oauth_nonce', '', request, 0));
  return response;
}
