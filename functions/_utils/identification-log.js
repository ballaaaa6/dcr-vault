const RETENTION_SECONDS = 7 * 24 * 60 * 60;

export function safeLogPayload(value) {
  const text = JSON.stringify(value ?? {}).replace(/AIza[\w-]{20,}/g, '[redacted]');
  return text.length <= 24000 ? text : JSON.stringify({truncated: true});
}

export async function recordIdentification(db, userId, entry) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`INSERT INTO identification_logs
    (request_id, user_id, created_at, expires_at, model, duration_ms, outcome, reading_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(entry.requestId, userId, now, now + RETENTION_SECONDS, entry.model,
      entry.durationMs, entry.outcome, safeLogPayload(entry.reading)).run();
}

export async function safeRecordIdentification(db, userId, entry) {
  try { await recordIdentification(db, userId, entry); }
  catch (cause) { console.warn('Identification log unavailable.', {requestId: entry.requestId, code: cause?.name || 'Error'}); }
}
