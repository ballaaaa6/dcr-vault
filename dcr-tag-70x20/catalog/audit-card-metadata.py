#!/usr/bin/env python3
"""Audit the shipped card catalog without modifying it."""
import argparse
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "public" / "data" / "card-catalog.json"


def metadata(row):
    value = row[10] if len(row) > 10 else None
    if isinstance(value, dict):
        return value
    if isinstance(value, list):
        keys = ["nameAliases", "cardCount", "hp", "illustrator", "stage", "types", "attacks", "abilities"]
        return dict(zip(keys, value))
    return {}


def audit(data):
    languages = {}
    for row in data["cards"]:
        lang = str(row[1] or "unknown")
        result = languages.setdefault(lang, {"records": 0, "present": collections.Counter(), "identities": collections.Counter()})
        result["records"] += 1
        fields = {"name": row[2], "setName": row[3], "year": row[4], "number": row[5],
                  "rarity": row[6], "setId": row[8], **metadata(row)}
        result["present"].update(key for key, value in fields.items() if value)
        if row[2] and row[5]:
            result["identities"][(str(row[2]).strip().casefold(), str(row[5]).strip().casefold())] += 1
    return {"sourceCommit": data.get("sourceCommit"), "schemaVersion": data.get("schemaVersion"),
            "total": len(data["cards"]), "verifiedSetMappings": len(data.get("verifiedPrintedCodes", {})),
            "languages": {lang: {"records": value["records"], "present": dict(value["present"]),
                "duplicateNameNumberRows": sum(n for n in value["identities"].values() if n > 1)}
                for lang, value in sorted(languages.items())}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=CATALOG)
    args = parser.parse_args()
    data = json.loads(args.catalog.read_text(encoding="utf-8"))
    print(json.dumps(audit(data), ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
