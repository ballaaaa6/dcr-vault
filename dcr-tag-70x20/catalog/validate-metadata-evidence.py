#!/usr/bin/env python3
"""Validate the reviewed metadata evidence inventory without changing it."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
STATUSES = {"verified", "source-only", "conflict", "not-applicable", "unknown"}


def validate(data):
    errors = []
    if data.get("schemaVersion") != 1 or not data.get("reviewedAt"):
        errors.append("Missing schema version or review date")
    seen = set()
    for record in data.get("records", []):
        identity = record.get("id", "")
        if not identity or identity in seen:
            errors.append(f"Missing or duplicate identity: {identity!r}")
        seen.add(identity)
        source = record.get("source", "")
        if urlsplit(source).scheme != "https" or not urlsplit(source).netloc:
            errors.append(f"{identity}: invalid source URL")
        fields = record.get("fields")
        if not isinstance(fields, dict) or not fields:
            errors.append(f"{identity}: missing fields")
            continue
        for name, field in fields.items():
            if not isinstance(field, dict) or field.get("status") not in STATUSES:
                errors.append(f"{identity}.{name}: invalid status")
                continue
            value = field.get("value")
            status = field["status"]
            if status in {"verified", "source-only"} and (value is None or str(value).strip() == ""):
                errors.append(f"{identity}.{name}: known value is empty")
            if status in {"unknown", "not-applicable"} and value not in (None, ""):
                errors.append(f"{identity}.{name}: unexpected value for {status}")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", nargs="?", type=Path, default=HERE / "metadata-evidence.json")
    args = parser.parse_args()
    data = json.loads(args.file.read_text(encoding="utf-8"))
    errors = validate(data)
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Validated {len(data.get('records', []))} evidence records")


if __name__ == "__main__":
    main()
