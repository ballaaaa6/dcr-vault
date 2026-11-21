#!/usr/bin/env python3
"""Fill missing English images from a pinned PokemonTCG data snapshot."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import io
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

import requests
from PIL import Image

import card_image_library as library


ROOT = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data"
OUTPUT = library.DEFAULT_OUTPUT
DATABASE = library.DEFAULT_DATABASE


def normalized(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def fetch_json(url):
    response = requests.get(url, timeout=(10, 30), headers={"User-Agent": "DCR-Card-Vault/1.0"})
    response.raise_for_status()
    return response.json()


def candidates(records, source_cards):
    """Require an unambiguous match on set, collector number, and printed name."""
    index = {}
    for card in source_cards:
        key = (normalized(card.get("number", "")), normalized(card.get("name", "")))
        index.setdefault(key, []).append(card)
    local = {}
    for record in records:
        key = (normalized(record["local_id"]), normalized(record["card_name"]))
        local.setdefault(key, []).append(record)
    for key, matches in local.items():
        remote = index.get(key, [])
        if all(key) and len(matches) == len(remote) == 1:
            url = remote[0].get("images", {}).get("small", "")
            if url.startswith("https://images.pokemontcg.io/"):
                yield matches[0], url


def select_sets(db, source_sets):
    groups = {}
    for item in source_sets:
        groups.setdefault(normalized(item.get("name", "")), []).append(item)
    rows = db.execute("""SELECT DISTINCT i.set_id, l.set_name FROM card_images i
        JOIN catalog.card_locales l ON l.source_path=i.source_path AND l.language=i.language
        WHERE i.language='en' AND i.status='http_404'""").fetchall()
    for row in rows:
        options = groups.get(normalized(row["set_name"] or ""), [])
        if len(options) == 1:
            yield row["set_id"], options[0]["id"]


def download_image(record, url, output):
    response = requests.get(url, timeout=(10, 30), headers={"User-Agent": "DCR-Card-Vault/1.0"})
    response.raise_for_status()
    with Image.open(io.BytesIO(response.content)) as original:
        original.load()
        original.thumbnail((245, 337), Image.Resampling.LANCZOS)
        data = io.BytesIO()
        original.convert("RGB").save(data, format="WEBP", quality=85)
    raw = data.getvalue()
    phash, width, height = library.image_phash(raw)
    path = Path("images") / library.safe_part(record["language"]) / library.safe_part(record["set_id"]) / (library.safe_part(record["api_id"]) + ".webp")
    target = output / path
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        existing = target.read_bytes()
        if existing != raw:
            raise FileExistsError(f"Existing image differs from source: {target}")
        return path.as_posix(), len(raw), hashlib.sha256(raw).hexdigest(), phash, width, height
    temporary = target.with_suffix(".webp.tmp")
    temporary.write_bytes(raw)
    temporary.replace(target)
    return path.as_posix(), len(raw), hashlib.sha256(raw).hexdigest(), phash, width, height


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", required=True, help="40-character PokemonTCG data commit")
    parser.add_argument("--workers", type=int, default=2, choices=range(1, 5))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.commit):
        parser.error("--commit must be a full lowercase Git commit SHA")
    root = f"{ROOT}/{args.commit}"
    source_sets = fetch_json(f"{root}/sets/en.json")
    db = library.connect_index(OUTPUT / "image-index.sqlite")
    db.execute("ATTACH DATABASE ? AS catalog", (str(DATABASE.resolve()),))
    jobs = []
    for local_set, remote_set in select_sets(db, source_sets):
        try:
            source_cards = fetch_json(f"{root}/cards/en/{remote_set}.json")
        except requests.RequestException as exc:
            print(f"Set {local_set}: metadata unavailable: {exc}", flush=True)
            continue
        records = db.execute("SELECT * FROM card_images WHERE language='en' AND set_id=? AND status='http_404'", (local_set,)).fetchall()
        jobs.extend(candidates(records, source_cards))
    print(f"Matched {len(jobs)} missing cards from pinned source {args.commit}.", flush=True)
    if args.dry_run:
        return
    success = errors = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download_image, row, url, OUTPUT): (row, url) for row, url in jobs}
        for future in as_completed(futures):
            row, url = futures[future]
            try:
                path, size, sha, phash, width, height = future.result()
                db.execute("""UPDATE card_images SET status='downloaded', image_url_source='pokemon_tcg_data',
                    cached_image_url=?, image_path=?, bytes=?, sha256=?, phash=?, width=?, height=?,
                    fetched_at_utc=?, http_status=200, error=NULL WHERE source_path=? AND language=?""",
                    (url, path, size, sha, phash, width, height, library.utc_now(), row['source_path'], 'en'))
                success += 1
            except Exception as exc:
                errors += 1
                print(f"Failed {row['api_id']}: {type(exc).__name__}: {exc}", flush=True)
            if (success + errors) % 25 == 0:
                db.commit()
                print(f"Processed {success + errors}/{len(jobs)}; saved {success}; failed {errors}.", flush=True)
    db.commit()
    payload = library.library_summary(db, DATABASE, OUTPUT)
    payload['source'] = 'TCGdex and PokemonTCG data image cache'
    payload['pokemon_tcg_data_commit'] = args.commit
    library.write_json(OUTPUT / 'manifest.json', payload)
    db.close()
    print(f"Complete: saved {success}; failed {errors}.", flush=True)


if __name__ == '__main__':
    main()
