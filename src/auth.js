async function requestJson(path, options = {}) {
  const response = await fetch(path, {credentials: 'same-origin', ...options});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

export async function getCurrentUser() {
  const result = await requestJson('/api/auth/session');
  return result.user || null;
}

export async function getGoogleConfig() {
  return requestJson('/api/auth/config');
}

export async function signInWithGoogle(credential) {
  return requestJson('/api/auth/google', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({credential})
  });
}

export async function signOut() {
  await requestJson('/api/auth/logout', {method: 'POST'});
  location.href = '/';
}
