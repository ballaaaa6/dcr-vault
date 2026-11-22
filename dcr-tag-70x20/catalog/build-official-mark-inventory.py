"""Inventory source-reported sets backed by official card and mark URLs."""

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent
LANGUAGES = {'data_jp': ('ja', 'www.pokemon-card.com'),
             'data_ko': ('ko', 'pokemoncard.co.kr'),
             'data_tc': ('zh-tw', 'asia.pokemon-card.com')}


def collect(archive):
    groups = defaultdict(lambda: {'count': 0, 'cards': Counter(), 'names': Counter()})
    with ZipFile(archive) as bundle:
        for path in bundle.namelist():
            parts = path.split('/')
            if len(parts) < 4 or parts[1] not in LANGUAGES or not path.endswith('.json'):
                continue
            try:
                card = json.loads(bundle.read(path))
            except (ValueError, UnicodeDecodeError):
                continue
            language, domain = LANGUAGES[parts[1]]
            url, mark = card.get('url') or '', card.get('set_img') or ''
            if urlparse(url).hostname != domain or not card.get('set_name'):
                continue
            key = (language, str(card['set_name']), mark)
            groups[key]['count'] += 1
            groups[key]['cards'][url] += 1
    return groups


def source_names():
    lookup = defaultdict(set)
    with (ROOT / 'set-inventory-sources.csv').open(encoding='utf-8-sig', newline='') as file:
        for row in csv.DictReader(file):
            if row['source'] == 'TCGdex API':
                lookup[(row['language'], row['source_id'].casefold())].add(row['set_name'])
    return lookup


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('archive', type=Path, help='Pinned PTCG-database source ZIP')
    args = parser.parse_args()
    groups, names = collect(args.archive), source_names()
    fields = ['language', 'source_set_identifier', 'candidate_names_from_matching_id',
              'official_set_mark_url', 'official_card_example', 'card_records', 'status', 'source']
    with (ROOT / 'official-card-mark-inventory.csv').open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for (language, set_id, mark), info in sorted(groups.items()):
            writer.writerow(dict(language=language, source_set_identifier=set_id,
                                 candidate_names_from_matching_id=' | '.join(sorted(names[(language, set_id.casefold())])),
                                 official_set_mark_url=mark, official_card_example=min(info['cards']),
                                 card_records=info['count'],
                                 status='source identifier and name match require review; mark URL is not a transcription',
                                 source='https://github.com/type-null/PTCG-database/tree/18e0de2feb7a35ebe4296ede0ba6cc768961489b'))
    print(f'{len(groups)} language, source identifier and mark combinations')


if __name__ == '__main__':
    main()
