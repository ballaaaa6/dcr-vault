#!/usr/bin/env python3
"""Build a human-readable English set rarity reference from the pinned catalog."""

import json
import sqlite3
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "catalog" / "cards.sqlite"
OVERRIDES = ROOT / "catalog" / "set-rarity-overrides.json"
OUTPUT = ROOT / "catalog" / "RARITY-REFERENCE.md"


def rarity_value(value):
    text = str(value or "").strip()
    return "" if text.casefold() in {"", "none", "null", "undefined"} else text


def load_rows():
    query = """SELECT l.set_id, l.set_name, c.rarity
               FROM card_locales l JOIN cards c USING (source_path)
               WHERE l.language = 'en'
               ORDER BY l.set_name COLLATE NOCASE, l.set_id"""
    with sqlite3.connect(f"file:{DATABASE.as_posix()}?mode=ro&immutable=1", uri=True) as db:
        source_commit = db.execute("SELECT value FROM catalog_meta WHERE key='source_commit'").fetchone()[0]
        return source_commit, list(db.execute(query))


def main():
    if not DATABASE.is_file():
        raise SystemExit("Catalog database is missing; import the pinned snapshot first.")
    source_commit, rows = load_rows()
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")).get("sets", {})
    sets = defaultdict(lambda: {"name": "", "counts": defaultdict(int), "missing": 0})
    for set_id, set_name, raw_rarity in rows:
        entry = sets[set_id]
        entry["name"] = set_name or set_id
        rarity = rarity_value(raw_rarity)
        entry["counts"][rarity] += 1
        entry["missing"] += not bool(rarity)

    lines = [
        "# English Set Rarity Reference", "",
        f"Generated from the pinned TCGdex catalog snapshot `{source_commit}`.",
        "The set values below are source rarity names, not DCR label codes.",
        "The Add Card dropdown is scoped to the selected set; choosing a card preselects its recorded rarity or a verified uniform set default.",
        "A blank source value stays blank. Verify any missing value against the exact printing before adding an override.",
        "Pokémon's database guide identifies the rarity symbol at the lower-right of a card as the source for rarity.",
        "Source: https://support.pokemon.com/hc/en-us/articles/360001025274-How-do-I-use-the-Trading-Card-Game-database", "",
        "| Set ID | English set name | Recorded rarity values | Catalog rows without rarity | Override evidence |",
        "| --- | --- | --- | ---: | --- |"
    ]
    catalog_empty_sets = []
    unresolved_empty_sets = []
    reviewed_no_rarity_sets = []
    for set_id in sorted(sets, key=lambda item: (sets[item]["name"].casefold(), item)):
        entry = sets[set_id]
        override = overrides.get(set_id, {})
        recorded = [name for name in entry["counts"] if name]
        additions = [value for value in override.get("rarities", []) if value not in recorded]
        values = recorded + additions
        if not recorded:
            catalog_empty_sets.append(set_id)
        if not values:
            if override.get("noPrintedRarity"):
                reviewed_no_rarity_sets.append(set_id)
                shown = "No printed rarity symbol (reviewed)"
            else:
                unresolved_empty_sets.append(set_id)
                shown = "No catalog value; needs exact-print review"
        else:
            shown = "; ".join(f"{name} ({entry['counts'].get(name, 0)})" for name in recorded)
            if additions:
                shown += ("; " if shown else "") + f"verified set values: {', '.join(additions)}"
        if override.get("defaultRarity"):
            shown += f"; uniform default for cards with no catalog rarity: {override['defaultRarity']}"
        sources = override.get("sources", [])
        evidence = ", ".join(f"[source {index}](<{url}>)" for index, url in enumerate(sources, 1))
        if evidence:
            evidence += f"; reviewed {override.get('reviewedAt', 'date not recorded')}"
        lines.append(f"| `{set_id}` | {entry['name']} | {shown} | {entry['missing']} | {evidence or '—'} |")
    lines.extend(["", f"Sets with no rarity recorded in the source catalog: {len(catalog_empty_sets)}."])
    lines.append(f"Reviewed as having no printed rarity symbol: {len(reviewed_no_rarity_sets)}.")
    lines.append(f"Still requiring exact-print review: {len(unresolved_empty_sets)}.")
    if unresolved_empty_sets:
        lines.append("These sets stay blank until exact-print evidence is reviewed and recorded in `set-rarity-overrides.json`.")
    lines.extend([
        "", "## Review rules", "",
        "- Source rarity names are kept on card records. `catalog-label-rules.json` maps only reviewed names to DCR rarity codes.",
        "- A set-level rarity list describes values found among cards in that set; it does not prove the rarity of a specific card.",
        "- For a missing value, check an authoritative checklist for the same set and printing. Record the source URL, review date, and the exact rarity name in `set-rarity-overrides.json`.",
        "- Do not infer rarity from foil, artwork, price, or a different language/printing. Unsupported label mappings remain blocked until reviewed.", ""
    ])
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(sets)} sets; {len(catalog_empty_sets)} lack catalog rarity, "
          f"{len(reviewed_no_rarity_sets)} confirm no rarity symbol, "
          f"{len(unresolved_empty_sets)} need exact-print review.")


if __name__ == "__main__":
    main()
