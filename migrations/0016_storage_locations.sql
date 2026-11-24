ALTER TABLE cards ADD COLUMN storage_location_id TEXT REFERENCES storage_locations(id) ON DELETE SET NULL;
ALTER TABLE cards ADD COLUMN storage_position TEXT NOT NULL DEFAULT '';
CREATE TABLE storage_locations (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  UNIQUE(user_id, name_key)
);
CREATE INDEX cards_storage_location_idx ON cards(user_id, storage_location_id);
