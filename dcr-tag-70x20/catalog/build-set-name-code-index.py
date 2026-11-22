"""Build a source-qualified set name and code index without inferring print marks."""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    with (ROOT / 'set-inventory-sources.csv').open(encoding='utf-8-sig', newline='') as file:
        rows = list(csv.DictReader(file))
    abbreviations = json.loads((ROOT / 'set-code-english-source.json').read_text(encoding='utf-8'))
    codes = {row['id'].casefold(): row['code'] for row in abbreviations['sets'] if row.get('code')}
    verified = json.loads((ROOT / 'verified-printed-codes.json').read_text(encoding='utf-8'))['mappings']
    mappings = {(row['language'], row['setId'].casefold()): row for row in verified
                if row.get('status') == 'verified'}
    fields = ['language', 'set_name', 'source', 'source_id', 'source_id_type',
              'decklist_abbreviation', 'decklist_source', 'printed_code',
              'printed_code_status', 'printed_code_evidence', 'source_url']
    output = []
    for row in rows:
        # Only exact TCGdex identifiers have a supported cross-source ID mapping.
        key = (row['language'], row['source_id'].casefold())
        mapped = mappings.get(key) if row['source'] == 'TCGdex API' else None
        code = codes.get(key[1], '') if row['language'] == 'en' and row['source'] == 'TCGdex API' else ''
        output.append(dict(language=row['language'], set_name=row['set_name'],
                           source=row['source'], source_id=row['source_id'],
                           source_id_type=row['code_type'], decklist_abbreviation=code,
                           decklist_source=abbreviations['source'] if code else '',
                           printed_code=mapped['printedCode'] if mapped else '',
                           printed_code_status='verified' if mapped else 'unverified',
                           printed_code_evidence=' | '.join(mapped['sources']) if mapped else '',
                           source_url=row['source_url']))
    for key, mapped in mappings.items():
        if not any(row['language'] == key[0] and row['printed_code'] == mapped['printedCode'] for row in output):
            output.append(dict(language=key[0], set_name=mapped.get('englishSetName', ''),
                               source='Verified printed code', source_id=mapped['setId'],
                               source_id_type='reviewed mapping', decklist_abbreviation='',
                               decklist_source='', printed_code=mapped['printedCode'],
                               printed_code_status='verified',
                               printed_code_evidence=' | '.join(mapped['sources']),
                               source_url=mapped['sources'][0]))
    with (ROOT / 'set-name-code-index.csv').open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(output)
    print(f'{len(output)} source rows; {sum(bool(row["decklist_abbreviation"]) for row in output)} deck-list abbreviations; {sum(bool(row["printed_code"]) for row in output)} verified printed codes')


if __name__ == '__main__':
    main()
