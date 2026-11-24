ALTER TABLE collections ADD COLUMN share_enabled INTEGER NOT NULL DEFAULT 0;
UPDATE collections SET share_enabled = 1 WHERE share_token IS NOT NULL;
