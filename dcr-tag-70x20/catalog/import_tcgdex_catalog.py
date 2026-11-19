#!/usr/bin/env python3
"""Import TCGdex's multilingual source database into a searchable SQLite catalog."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import urllib.request
import zipfile


HERE = Path(__file__).resolve().parent
PARSER = HERE / "parse_tcgdex_source.mjs"
DEFAULT_DB = HERE / "cards.sqlite"
LANGUAGES = ("en", "th", "ko", "zh-tw", "zh-cn", "ja")
PINNED_COMMIT = "4218f64dcbf3de6e7b7548530f938fb0b9ebbe2a"
USER_AGENT = "DCR-Pokemon-Tag-Catalog-Importer/1.0"


def download_snapshot(work: Path) -> tuple[Path, str]:
    commit = PINNED_COMMIT
    archive_url = f"https://codeload.github.com/tcgdex/cards-database/zip/{commit}"
    archive_path = work / "tcgdex-source.zip"
    request = urllib.request.Request(archive_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=180) as response, archive_path.open("wb") as out:
        shutil.copyfileobj(response, out)
    with zipfile.ZipFile(archive_path) as archive:
        # Reject paths that would escape the temporary extraction directory.
        root = work.resolve()
        for member in archive.infolist():
            target = (work / member.filename).resolve()
            if root not in target.parents and target != root:
                raise ValueError(f"Unsafe path in source archive: {member.filename}")
        archive.extractall(work)
    source = next(work.glob("cards-database-*"))
    return source, commit


def localized(value, language, universal=False):
    if isinstance(value, dict):
        return value.get(language)
    return value if (universal or language == "en") and isinstance(value, str) else None


def create_schema(db: sqlite3.Connection) -> None:
    db.executescript("""
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = DELETE;
        PRAGMA synchronous = NORMAL;
        CREATE TABLE catalog_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE series (
            source_path TEXT PRIMARY KEY,
            series_id TEXT NOT NULL,
            raw_json TEXT NOT NULL
        );
        CREATE TABLE sets (
            source_path TEXT PRIMARY KEY,
            set_id TEXT NOT NULL,
            series_path TEXT NOT NULL,
            raw_json TEXT NOT NULL,
            FOREIGN KEY(series_path) REFERENCES series(source_path)
        );
        CREATE TABLE cards (
            source_path TEXT PRIMARY KEY,
            source_scope TEXT NOT NULL,
            set_path TEXT NOT NULL,
            set_id TEXT NOT NULL,
            local_id TEXT NOT NULL,
            api_id TEXT NOT NULL,
            category TEXT,
            rarity TEXT,
            illustrator TEXT,
            raw_json TEXT NOT NULL,
            FOREIGN KEY(set_path) REFERENCES sets(source_path)
        );
        CREATE TABLE card_locales (
            source_path TEXT NOT NULL,
            language TEXT NOT NULL,
            card_name TEXT NOT NULL,
            set_id TEXT NOT NULL,
            local_id TEXT NOT NULL,
            set_name TEXT,
            series_name TEXT,
            release_date TEXT,
            PRIMARY KEY(source_path, language),
            FOREIGN KEY(source_path) REFERENCES cards(source_path)
        );
        CREATE TABLE api_enrichment (
            source_path TEXT NOT NULL,
            language TEXT NOT NULL,
            fetched_at_utc TEXT NOT NULL,
            raw_json TEXT NOT NULL,
            PRIMARY KEY(source_path, language),
            FOREIGN KEY(source_path) REFERENCES cards(source_path)
        );
    """)


def import_stream(db: sqlite3.Connection, source: Path, commit: str, node_path: str, ts_path: str) -> dict:
    env = os.environ.copy()
    env["TYPESCRIPT_PATH"] = ts_path
    process = subprocess.Popen(
        [node_path, str(PARSER), str(source)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        env=env,
    )
    assert process.stdout is not None
    counts = {"serie": 0, "set": 0, "card": 0, "localized": 0}
    set_meta: dict[str, dict] = {}
    series_meta: dict[str, dict] = {}
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    db.execute("BEGIN IMMEDIATE")
    try:
        for line_number, line in enumerate(process.stdout, 1):
            if not line.strip():
                continue
            record = json.loads(line)
            kind = record["kind"]
            raw = record["raw"]
            raw_json = json.dumps(raw, ensure_ascii=False, separators=(",", ":"))
            if kind == "serie":
                source_path = record["source_path"]
                series_meta[source_path] = raw
                db.execute("INSERT INTO series VALUES (?, ?, ?)", (source_path, str(raw.get("id", "")), raw_json))
                counts["serie"] += 1
            elif kind == "set":
                source_path = record["source_path"]
                series_path = record["series_path"]
                if series_path not in series_meta:
                    raise ValueError(f"Missing series metadata for {source_path}: expected {series_path}")
                set_meta[source_path] = raw
                db.execute("INSERT INTO sets VALUES (?, ?, ?, ?)", (source_path, str(raw.get("id", "")), series_path, raw_json))
                counts["set"] += 1
            elif kind == "card":
                source_path = record["source_path"]
                set_path = record["set_path"]
                set_id = str(record["set_id"])
                local_id = str(record["local_id"])
                db.execute(
                    "INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (source_path, record["scope"], set_path, set_id, local_id, f"{set_id}-{local_id}",
                     raw.get("category"), raw.get("rarity"), raw.get("illustrator"), raw_json),
                )
                set_raw = set_meta[set_path]
                serie_raw = series_meta.get(f"{record['scope']}/{Path(set_path).parts[1]}.ts", {})
                names = raw.get("name") if isinstance(raw.get("name"), dict) else {"en": raw.get("name")} if isinstance(raw.get("name"), str) else {}
                set_names = set_raw.get("name", {})
                serie_names = serie_raw.get("name", {})
                release_dates = set_raw.get("releaseDate", {})
                for language in LANGUAGES:
                    card_name = localized(names, language)
                    if not card_name:
                        continue
                    db.execute(
                        "INSERT INTO card_locales VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (source_path, language, str(card_name), set_id, local_id,
                         localized(set_names, language), localized(serie_names, language), localized(release_dates, language, universal=True)),
                    )
                    counts["localized"] += 1
                counts["card"] += 1
            else:
                raise ValueError(f"Unknown row type at parser line {line_number}: {kind}")
        return_code = process.wait()
        if return_code:
            error = process.stderr.read() if process.stderr else ""
            raise RuntimeError(f"TypeScript source parser failed ({return_code}): {error[-5000:]}")

        db.executescript("""
            CREATE INDEX idx_card_locale_name ON card_locales(language, card_name COLLATE NOCASE);
            CREATE INDEX idx_card_locale_set_number ON card_locales(language, set_id, local_id);
            CREATE INDEX idx_card_set_number ON cards(set_id, local_id);
            CREATE INDEX idx_card_api_id ON cards(api_id);
            CREATE INDEX idx_card_rarity ON cards(rarity);
        """)
        db.executemany("INSERT INTO catalog_meta VALUES (?, ?)", [
            ("source", "tcgdex/cards-database"),
            ("source_license", "MIT"),
            ("source_commit", commit),
            ("imported_at_utc", now),
            ("languages", ",".join(LANGUAGES)),
            ("images_downloaded", "false"),
            ("prices_included", "false; third-party reference IDs are preserved in raw card data"),
            ("record_policy", "one source record per row; card_locales contains requested printed-name locales"),
        ])
        db.commit()
    except Exception:
        db.rollback()
        process.kill()
        process.wait()
        raise
    finally:
        process.stdout.close()
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="Use an already extracted cards-database checkout")
    parser.add_argument("--source-commit", default="unknown", help="Commit SHA for --source-dir")
    parser.add_argument("--output", type=Path, default=DEFAULT_DB)
    parser.add_argument("--node", default="node")
    parser.add_argument("--typescript", type=Path, help="Path to typescript.js (defaults to catalog/node_modules/typescript/lib/typescript.js)")
    args = parser.parse_args()

    ts_path = args.typescript or (HERE / "node_modules" / "typescript" / "lib" / "typescript.js")
    if not ts_path.is_file():
        print("TypeScript is required. Run `npm ci --prefix dcr-tag-70x20/catalog` first.", file=sys.stderr)
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="tcgdex-catalog-") as temp_name:
        work = Path(temp_name)
        if args.source_dir:
            source = args.source_dir.resolve()
            commit = args.source_commit
        else:
            source, commit = download_snapshot(work)
        temp_db = args.output.with_suffix(args.output.suffix + ".building")
        if temp_db.exists():
            temp_db.unlink()
        db = sqlite3.connect(temp_db)
        try:
            create_schema(db)
            counts = import_stream(db, source, commit, args.node, str(ts_path))
            db.execute("PRAGMA optimize")
        finally:
            db.close()
        temp_db.replace(args.output)

    with sqlite3.connect(args.output) as db:
        per_language = dict(db.execute("SELECT language, COUNT(*) FROM card_locales GROUP BY language ORDER BY language"))
        duplicate_keys = db.execute("""
            SELECT COUNT(*) FROM (
                SELECT language, set_id, local_id FROM card_locales
                GROUP BY language, set_id, local_id HAVING COUNT(*) > 1
            )
        """).fetchone()[0]
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
    size_mib = args.output.stat().st_size / (1024 * 1024)
    print(json.dumps({"output": str(args.output.resolve()), "commit": commit, "counts": counts,
                      "localized_cards_by_language": per_language, "duplicate_language_set_number_keys": duplicate_keys,
                      "integrity": integrity, "size_mib": round(size_mib, 2)}, ensure_ascii=False, indent=2))
    return 0 if integrity == "ok" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        raise
