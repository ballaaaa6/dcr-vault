#!/usr/bin/env python3
"""Fill missing Japanese Pokemon images using independently corroborated identities."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re

import requests

import card_image_library as library
from import_pokemon_tcg_images import DATABASE, OUTPUT, download_image, fetch_json, normalized


ROOT = 'https://raw.githubusercontent.com/cardcorpus/pokemon-card-dataset'


def card_number(value):
    value = str(value or '').strip().upper()
    return str(int(value)) if value.isdigit() else value


def matched_cards(records, cards):
    local, remote = {}, {}
    for row in records:
        local.setdefault(card_number(row['local_id']), []).append(row)
    for card in cards:
        number = card_number(card.get('number', {}).get('numerator'))
        remote.setdefault(number, []).append(card)
    for number, rows in local.items():
        matches = remote.get(number, [])
        if not number or len(rows) != 1 or len(matches) != 1:
            continue
        row, card = rows[0], matches[0]
        source = json.loads(row['raw_json'])
        dex = set(source.get('dexId') or [])
        species = {item.get('species') for item in card.get('species', [])}
        artist = normalized(source.get('illustrator') or '')
        credit = normalized(card.get('credit') or '')
        if (dex and species and dex != species) or (artist and credit and artist != credit):
            continue
        if not ((dex and species and dex == species) or (artist and credit and artist == credit)):
            continue
        image_id = card.get('picture', {}).get('front', {}).get('image', '')
        if re.fullmatch(r'[0-9a-f]{32}', image_id):
            yield row, f'https://img.cardcorpus.com/s1/240/{image_id}.avif'


def get_jobs(db, root):
    sets = fetch_json(f'{root}/v1/sets.json')['sets']
    by_code = {}
    for item in sets:
        if item.get('language') == 'ja' and item.get('code'):
            by_code.setdefault(item['code'].casefold(), []).append(item)
    missing_sets = db.execute("""SELECT set_id FROM card_images WHERE language='ja'
        AND status='http_404' GROUP BY set_id""").fetchall()
    jobs = []
    for row in missing_sets:
        set_id = row['set_id']
        found = by_code.get(set_id.casefold(), [])
        if len(found) != 1 or not re.fullmatch(r'japanese/[a-z0-9-]+', found[0]['id']):
            continue
        try:
            cards = fetch_json(f"{root}/v1/sets/{found[0]['id']}.json")['cards']
        except (requests.RequestException, KeyError, ValueError) as exc:
            print(f'Set {set_id}: metadata unavailable: {exc}', flush=True)
            continue
        records = db.execute("""SELECT i.*, c.raw_json FROM card_images i
            JOIN catalog.cards c ON c.source_path=i.source_path
            WHERE i.language='ja' AND i.set_id=? AND i.status='http_404'""", (set_id,)).fetchall()
        jobs.extend(matched_cards(records, cards))
    return jobs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--workers', type=int, choices=range(1, 5), default=2)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.commit):
        parser.error('--commit must be a full lowercase Git commit SHA')
    db = library.connect_index(OUTPUT / 'image-index.sqlite')
    db.execute('ATTACH DATABASE ? AS catalog', (str(DATABASE.resolve()),))
    jobs = get_jobs(db, f'{ROOT}/{args.commit}')
    print(f'Matched {len(jobs)} Japanese cards using set, number and corroborating species or artist.', flush=True)
    if args.dry_run:
        return
    success = errors = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download_image, row, url, OUTPUT): (row, url) for row, url in jobs}
        for future in as_completed(futures):
            row, url = futures[future]
            try:
                path, size, sha, phash, width, height = future.result()
                db.execute("""UPDATE card_images SET status='downloaded', image_url_source='cardcorpus',
                    cached_image_url=?, image_path=?, bytes=?, sha256=?, phash=?, width=?, height=?,
                    fetched_at_utc=?, http_status=200, error=NULL WHERE source_path=? AND language=?""",
                    (url, path, size, sha, phash, width, height, library.utc_now(), row['source_path'], 'ja'))
                success += 1
            except Exception as exc:
                errors += 1
                print(f"Failed {row['api_id']}: {type(exc).__name__}: {exc}", flush=True)
            if (success + errors) % 25 == 0:
                db.commit()
                print(f'Processed {success + errors}/{len(jobs)}; saved {success}; failed {errors}.', flush=True)
    db.commit()
    payload = library.library_summary(db, DATABASE, OUTPUT)
    payload['source'] = 'TCGdex, PokemonTCG data, and CardCorpus image cache'
    payload['cardcorpus_commit'] = args.commit
    library.write_json(OUTPUT / 'manifest.json', payload)
    db.close()
    print(f'Complete: saved {success}; failed {errors}.', flush=True)


if __name__ == '__main__':
    main()
