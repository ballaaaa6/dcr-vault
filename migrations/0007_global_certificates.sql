-- This fails safely if existing accounts have conflicting certificate numbers.
CREATE UNIQUE INDEX cards_cert_global_idx ON cards (cert_number);
DROP INDEX cards_owner_cert_idx;
