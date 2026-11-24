ALTER TABLE collections ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE collections ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX collections_share_token_idx ON collections(share_token);
ALTER TABLE collection_cards ADD COLUMN sort_order INTEGER;
