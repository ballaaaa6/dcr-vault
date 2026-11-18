PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX users_email_idx ON users (email);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE cards (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game TEXT NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  set_name TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  card_number TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL DEFAULT '',
  grade_label TEXT NOT NULL DEFAULT '',
  cert_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in-vault',
  buy_price REAL,
  sell_price REAL,
  buy_date TEXT NOT NULL DEFAULT '',
  sold_date TEXT NOT NULL DEFAULT '',
  bought_from TEXT NOT NULL DEFAULT '',
  sold_to TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (length(cert_number) = 8),
  CHECK (status IN ('in-vault', 'for-sale', 'sold', 'grading'))
);

CREATE UNIQUE INDEX cards_owner_cert_idx ON cards (user_id, cert_number);
CREATE INDEX cards_owner_created_idx ON cards (user_id, created_at DESC);
