PRAGMA foreign_keys = ON;

CREATE TABLE card_images (
  card_id TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('front', 'back')),
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
  sha256 TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, side)
);

CREATE INDEX card_images_owner_idx ON card_images (user_id, card_id);

CREATE TABLE image_capabilities (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('front', 'back')),
  operation TEXT NOT NULL CHECK (operation IN ('put', 'get', 'delete')),
  content_type TEXT NOT NULL DEFAULT '',
  object_key TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX image_capabilities_expiry_idx ON image_capabilities (expires_at);
