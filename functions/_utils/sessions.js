import {cookie, cookieValue, error, requireDatabase} from './http.js';

const SESSION_COOKIE = 'dcr_session';
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function tokenHash(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function sessionCookie(token, request) {
  return cookie(SESSION_COOKIE, token, request, SESSION_SECONDS);
}

export function clearSessionCookie(request) {
  return cookie(SESSION_COOKIE, '', request, 0);
}

export async function createSession(db, userId) {
  const token = randomToken();
  const hash = await tokenHash(token);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)).run();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(hash, userId, expiresAt, Math.floor(Date.now() / 1000)).run();
  return token;
}

export async function currentUser(request, env) {
  const unavailable = requireDatabase(env);
  if (unavailable) return {response: unavailable};
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return {response: error('Sign-in required.', 401)};
  const hash = await tokenHash(token);
  const user = await env.DB.prepare(`SELECT u.id, u.email, u.created_at AS createdAt, u.display_name AS displayName, u.avatar_url AS avatarUrl, u.avatar_full_url AS avatarFullUrl, u.favorite_series AS favoriteSeries, u.bio AS bio, u.collecting_since AS collectingSince, u.collection_goal AS collectionGoal
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(hash, Math.floor(Date.now() / 1000)).first();
  if (!user) return {response: error('Sign-in required.', 401)};
  normalizeProfilePhoto(user);
  user.displayName = (user.displayName || user.email || '').slice(0, 20);
  return {user, hash};
}

export function normalizeProfilePhoto(user) {
  if (user.avatarFullUrl && /^https:\/\//i.test(user.avatarUrl || '')) {
    user.avatarUrl = user.avatarFullUrl;
  }
  return user;
}

export async function deleteSession(request, db) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token && db) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await tokenHash(token)).run();
}
