#!/usr/bin/env python3
"""Export the searchable, public TCGdex fields used by the Add Card form."""

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "dcr-tag-70x20" / "catalog" / "cards.sqlite"
OUTPUT = ROOT / "public" / "data" / "card-catalog.json"
RARITY_OVERRIDES = ROOT / "dcr-tag-70x20" / "catalog" / "set-rarity-overrides.json"


def normalize_rarity(value):
    rarity = str(value or "").strip()
    return "" if rarity.casefold() in {"", "none", "null", "undefined"} else rarity


def read_catalog():
    query = """
        SELECT c.api_id, l.language, l.card_name, l.set_name,
               substr(COALESCE(l.release_date, ''), 1, 4), l.local_id, COALESCE(c.rarity, ''),
               COALESCE(se.series_id, ''), COALESCE(l.set_id, ''),
               COALESCE(json_extract(se.raw_json, '$.name.en'), '')
        FROM card_locales l
        JOIN cards c USING (source_path)
        LEFT JOIN sets s ON s.source_path = c.set_path
        LEFT JOIN series se ON se.source_path = s.series_path
        ORDER BY l.language, l.card_name COLLATE NOCASE, l.set_id, l.local_id
    """
    with sqlite3.connect(f"file:{DATABASE.as_posix()}?mode=ro&immutable=1", uri=True) as db:
        commit = db.execute("SELECT value FROM catalog_meta WHERE key = 'source_commit'").fetchone()[0]
        cards = [list(row) for row in db.execute(query)]
    for card in cards:
        card[6] = normalize_rarity(card[6])
    return commit, cards


def read_rarity_overrides():
    data = json.loads(RARITY_OVERRIDES.read_text(encoding="utf-8"))
    sets = data.get("sets", {})
    if data.get("schemaVersion") != 1 or not isinstance(sets, dict):
        raise SystemExit("Set rarity overrides must use schemaVersion 1 and a sets object.")
    for set_id, entry in sets.items():
        valid = isinstance(entry, dict) and isinstance(entry.get("rarities"), list)
        valid = valid and isinstance(entry.get("sources"), list) and entry.get("sources")
        valid = valid and entry.get("reviewedAt") and all(str(url).startswith("https://") for url in entry["sources"])
        valid = valid and (bool(entry["rarities"]) or entry.get("noPrintedRarity") is True)
        if not valid or not all(str(value).strip() for value in entry["rarities"]):
            raise SystemExit(f"Rarity override for {set_id!r} needs rarity values, HTTPS sources, and reviewedAt.")
        default_rarity = entry.get("defaultRarity")
        if default_rarity and default_rarity not in entry["rarities"]:
            raise SystemExit(f"Default rarity for {set_id!r} must be one of its verified rarity values.")
    return sets


def main():
    if not DATABASE.is_file():
        raise SystemExit("Catalog database is missing; run import_tcgdex_catalog.py first.")
    commit, cards = read_catalog()
    overrides = read_rarity_overrides()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"schemaVersion": 4, "source": "TCGdex", "sourceCommit": commit, "cards": cards,
               "setRarityOverrides": overrides}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "cards": len(cards), "sourceCommit": commit,
                      "bytes": OUTPUT.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
