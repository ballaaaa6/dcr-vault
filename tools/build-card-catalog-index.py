#!/usr/bin/env python3
"""Export the searchable, public TCGdex fields used by the Add Card form."""

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "dcr-tag-70x20" / "catalog" / "cards.sqlite"
OUTPUT = ROOT / "public" / "data" / "card-catalog.json"


def read_catalog():
    query = """
        SELECT c.api_id, l.language, l.card_name, l.set_name,
               substr(COALESCE(l.release_date, ''), 1, 4), l.local_id, COALESCE(c.rarity, ''),
               COALESCE(se.series_id, '')
        FROM card_locales l
        JOIN cards c USING (source_path)
        LEFT JOIN sets s ON s.source_path = c.set_path
        LEFT JOIN series se ON se.source_path = s.series_path
        ORDER BY l.language, l.card_name COLLATE NOCASE, l.set_id, l.local_id
    """
    with sqlite3.connect(f"file:{DATABASE.as_posix()}?mode=ro&immutable=1", uri=True) as db:
        commit = db.execute("SELECT value FROM catalog_meta WHERE key = 'source_commit'").fetchone()[0]
        cards = [list(row) for row in db.execute(query)]
    return commit, cards


def main():
    if not DATABASE.is_file():
        raise SystemExit("Catalog database is missing; run import_tcgdex_catalog.py first.")
    commit, cards = read_catalog()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"schemaVersion": 2, "source": "TCGdex", "sourceCommit": commit, "cards": cards}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "cards": len(cards), "sourceCommit": commit,
                      "bytes": OUTPUT.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
