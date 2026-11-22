"""Collect a sample official card and mark for each Thai product filter."""

import csv
import re
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
BASE = 'https://asia.pokemon-card.com'


def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'DCR-Vault-Research/1.0'}), timeout=30) as response:
        return response.read().decode('utf-8')


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cards, self.marks = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        href, src = attrs.get('href') or '', attrs.get('src') or ''
        if tag == 'a' and re.fullmatch(r'/th/card-search/detail/\d+/', href):
            self.cards.append(urljoin(BASE, href))
        if tag == 'img' and '/card-img/mark/' in src:
            self.marks.append(urljoin(BASE, src))


def collect(row):
    url = BASE + '/th/card-search/list/?expansionCodes=' + quote(row['source_id'])
    listing = Links()
    listing.feed(fetch(url))
    if not listing.cards:
        return [row['source_id'], row['set_name'], url, '', '', 'no cards returned']
    detail = Links()
    detail.feed(fetch(listing.cards[0]))
    return [row['source_id'], row['set_name'], url, listing.cards[0],
            ' | '.join(sorted(set(detail.marks))), 'sample only; mark not transcribed']


def main():
    with (ROOT / 'set-inventory-sources.csv').open(encoding='utf-8-sig', newline='') as file:
        rows = [row for row in csv.DictReader(file) if row['source'] == 'Pokemon official Thailand']
    if len(rows) < 50:
        raise ValueError('Thai official source inventory unexpectedly short')
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(collect, rows))
    with (ROOT / 'thai-official-mark-samples.csv').open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['product_filter', 'product_name', 'official_list_url', 'sample_card_url', 'sample_mark_url', 'status'])
        writer.writerows(results)
    print(f'{len(results)} products; {sum(bool(row[4]) for row in results)} sample marks')


if __name__ == '__main__':
    main()
