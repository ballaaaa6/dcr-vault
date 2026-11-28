CREATE TABLE vault_celebrations (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER vault_celebration_first_card AFTER INSERT ON cards
WHEN (SELECT count(*) FROM cards WHERE user_id = NEW.user_id) = 1
BEGIN
  INSERT OR REPLACE INTO vault_celebrations(user_id) VALUES (NEW.user_id);
END;

CREATE TRIGGER vault_celebration_empty AFTER DELETE ON cards
WHEN NOT EXISTS (SELECT 1 FROM cards WHERE user_id = OLD.user_id)
BEGIN
  DELETE FROM vault_celebrations WHERE user_id = OLD.user_id;
END;
