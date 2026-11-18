function decodeBase64Url(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function signingKey(kid) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    cf: {cacheTtl: 3600, cacheEverything: true}
  });
  if (!response.ok) throw new Error('Google signing keys are unavailable.');
  const {keys = []} = await response.json();
  const jwk = keys.find(key => key.kid === kid && key.alg === 'RS256');
  if (!jwk) throw new Error('Google signing key was not found.');
  return crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
}

function validClaims(claims, clientId, nonce) {
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId;
  const issuer = ['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss);
  const authorizedParty = !Array.isArray(claims.aud) || claims.aud.length === 1 || claims.azp === clientId;
  return audience && authorizedParty && issuer && claims.exp > now && claims.iat <= now + 60 &&
    (!claims.nbf || claims.nbf <= now) && claims.sub &&
    claims.email && claims.email_verified === true && claims.nonce === nonce;
}

export async function verifyGoogleCredential(token, clientId, nonce) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid Google credential.');
  const header = decodeJson(parts[0]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid Google credential.');
  const key = await signingKey(header.kid);
  const signature = decodeBase64Url(parts[2]);
  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
  if (!valid) throw new Error('Invalid Google credential.');
  const claims = decodeJson(parts[1]);
  if (!validClaims(claims, clientId, nonce)) throw new Error('Google sign-in could not be verified.');
  return claims;
}
