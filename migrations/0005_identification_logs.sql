CREATE TABLE identification_logs (
  request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  model TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL,
  reading_json TEXT NOT NULL DEFAULT '{}',
  browser_json TEXT NOT NULL DEFAULT '{}',
  selection_json TEXT NOT NULL DEFAULT '{}',
  save_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX identification_logs_expiry_idx ON identification_logs(expires_at);
CREATE INDEX identification_logs_owner_idx ON identification_logs(user_id, created_at DESC);
