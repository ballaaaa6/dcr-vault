"""Build a set inventory from the shipped card catalog and a pinned English set list."""
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CATALOG = ROOT / 'public/data/card-catalog.json'
ENGLISH = HERE / 'set-code-english-source.json'
OUTPUT = HERE / 'set-code-reference.csv'


def clean(value):
    return str(value or '').strip()


def build_rows(catalog, english):
    sets = defaultdict(lambda: {'names': set(), 'series': set(), 'years': set(), 'cards': 0})
    for row in catalog['cards']:
        key = (clean(row[1]), clean(row[8]))
        item = sets[key]
        for field, index in [('names', 3), ('series', 9), ('years', 4)]:
            if clean(row[index]):
                item[field].add(clean(row[index]))
        item['cards'] += 1
    references = {item['id'].lower(): item for item in english['sets']}
    for item in english['sets']:
        sets.setdefault(('en', item['id']), {'names': set(), 'series': set(), 'years': set(), 'cards': 0})
    result = []
    for (language, set_id), data in sorted(sets.items()):
        ref = references.get(set_id.lower()) if language == 'en' else None
        result.append({
            'language': language, 'catalog_set_id': set_id,
            'catalog_set_name': ' | '.join(sorted(data['names'])),
            'catalog_series': ' | '.join(sorted(data['series'])),
            'catalog_year': ' | '.join(sorted(data['years'])), 'catalog_card_count': data['cards'],
            'english_reference_name': ref['name'] if ref else '',
            'english_reference_series': ref['series'] if ref else '',
            'ptcgo_decklist_code': ref['code'] if ref else '',
            'printed_code': '', 'printed_code_status': 'unverified',
            'source': 'TCGdex + Pokemon TCG data' if ref and data['cards'] else
                      'Pokemon TCG data' if ref else 'TCGdex',
        })
    return result


def main():
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    english = json.loads(ENGLISH.read_text(encoding='utf-8'))
    rows = build_rows(catalog, english)
    with OUTPUT.open('w', encoding='utf-8-sig', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f'Wrote {len(rows)} rows to {OUTPUT.name}')


if __name__ == '__main__':
    main()
