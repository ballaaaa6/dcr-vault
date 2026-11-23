CREATE TABLE gemini_rotation (id INTEGER PRIMARY KEY CHECK (id = 1), sequence INTEGER NOT NULL);
INSERT INTO gemini_rotation VALUES (1, -1);
CREATE TABLE gemini_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL, created_at INTEGER NOT NULL,
  key_slot INTEGER NOT NULL, key_id TEXT NOT NULL, model TEXT NOT NULL, outcome TEXT NOT NULL,
  http_status INTEGER, prompt_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER
);
CREATE INDEX gemini_attempts_time_key ON gemini_attempts(created_at, key_id);
