ALTER TABLE cards ADD COLUMN identification_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE cards ADD COLUMN field_provenance TEXT NOT NULL DEFAULT '{}';
