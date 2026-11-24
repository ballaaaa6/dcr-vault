CREATE TABLE collections (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  sort_order INTEGER,
  UNIQUE(user_id, name_key)
);

CREATE TABLE collection_cards (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  PRIMARY KEY(collection_id, card_id)
);
CREATE INDEX collection_cards_card_idx ON collection_cards(card_id);
