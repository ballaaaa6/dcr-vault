export async function reserveKey(db, count) {
  const row = await db.prepare('UPDATE gemini_rotation SET sequence = sequence + 1 WHERE id = 1 RETURNING sequence').first();
  if (!row || !Number.isSafeInteger(row.sequence)) throw new Error('Gemini rotation unavailable');
  return row.sequence % count;
}

export async function keyIdentifier(key) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(bytes)].slice(0, 8).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function recordAttempt(db, entry) {
  if (!db) return;
  const token = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  try {
    await db.prepare(`INSERT INTO gemini_attempts
      (request_id, created_at, key_slot, key_id, model, outcome, http_status, prompt_tokens, output_tokens, total_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(entry.requestId, Math.floor(Date.now() / 1000), entry.slot + 1,
      entry.keyId, entry.model, entry.outcome, entry.status, token(entry.usage?.promptTokenCount),
      token(entry.usage?.candidatesTokenCount), token(entry.usage?.totalTokenCount)).run();
  } catch (cause) { console.error('Gemini usage logging failed.', {requestId: entry.requestId, code: cause?.name || 'Error'}); }
}
