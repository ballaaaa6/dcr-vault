"""Refresh source inventories without treating catalog IDs as printed codes."""

import csv
import json
import re
from collections import Counter, defaultdict
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
LANGUAGES = 'en ja th ko zh-tw zh-cn id fr de es es-mx it pt nl pl ru'.split()
THAI_URL = 'https://asia.pokemon-card.com/th/card-search/'
ASIA_REGIONS = {'th': 'th', 'id': 'id', 'tw': 'zh-tw', 'hk': 'zh-tw',
                'sg': 'en', 'my': 'en', 'ph': 'en'}
FIELDS = 'language source source_id set_name card_count source_url code_type'.split()


def fetch(url):
    request = Request(url, headers={'User-Agent': 'DCR-Vault-Research/1.0'})
    with urlopen(request, timeout=40) as response:
        return response.read().decode('utf-8')


class ThaiProducts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pending = None
        self.label = None
        self.products = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'input' and 'expansionCode' in attrs.get('class', '').split():
            self.pending = (attrs.get('id'), attrs.get('value'))
        elif tag == 'label' and self.pending and attrs.get('for') == self.pending[0]:
            self.label = []

    def handle_data(self, data):
        if self.label is not None:
            self.label.append(data)

    def handle_endtag(self, tag):
        if tag == 'label' and self.label is not None:
            self.products.append((self.pending[1], ' '.join(''.join(self.label).split())))
            self.pending, self.label = None, None


class NomadSets(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_item = False
        self.in_link = False
        self.name = []
        self.href = ''
        self.items = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'li' and 'static-shelf-item' in attrs.get('class', '').split():
            self.in_item, self.name, self.href = True, [], ''
        elif self.in_item and tag == 'a':
            self.in_link, self.href = True, attrs.get('href', '')

    def handle_data(self, data):
        if self.in_item and (self.in_link or not self.href):
            self.name.append(data)

    def handle_endtag(self, tag):
        if tag == 'a':
            self.in_link = False
        if tag == 'li' and self.in_item:
            self.items.append((' '.join(''.join(self.name).split()), self.href))
            self.in_item = False


class KoreanProducts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.inside = False
        self.value = None
        self.label = []
        self.products = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'select' and attrs.get('name') == 'GoodsName':
            self.inside = True
        elif self.inside and tag == 'option':
            self.value, self.label = attrs.get('value', ''), []

    def handle_data(self, data):
        if self.inside and self.value is not None:
            self.label.append(data)

    def handle_endtag(self, tag):
        if tag == 'option' and self.value is not None:
            self.products.append((self.value, ' '.join(''.join(self.label).split())))
            self.value = None
        elif tag == 'select' and self.inside:
            self.inside = False


def collect_tcgdex():
    rows = []
    for language in LANGUAGES:
        url = f'https://api.tcgdex.net/v2/{language}/sets'
        data = json.loads(fetch(url))
        if not isinstance(data, list) or not data:
            raise ValueError(f'Empty or invalid set list: {url}')
        for item in data:
            rows.append(dict(language=language, source='TCGdex API',
                             source_id=item['id'], set_name=item['name'],
                             card_count=item.get('cardCount', {}).get('total', ''),
                             source_url=url, code_type='catalog ID'))
    return rows


def collect_thai():
    rows = []
    for region, language in ASIA_REGIONS.items():
        url = f'https://asia.pokemon-card.com/{region}/card-search/'
        parser = ThaiProducts()
        parser.feed(fetch(url))
        if len(parser.products) < 30:
            raise ValueError(f'Official product list unexpectedly short: {url}')
        source = 'Pokemon official Thailand' if region == 'th' else f'Pokemon official {region.upper()}'
        rows.extend(dict(language=language, source=source, source_id=code,
                         set_name=name, card_count='', source_url=url,
                         code_type='official product search code; printed code unverified')
                    for code, name in parser.products)
    return rows


def collect_korean():
    url = 'https://pokemoncard.co.kr/cards'
    parser = KoreanProducts()
    parser.feed(fetch(url))
    if len(parser.products) < 100:
        raise ValueError('Korean official product list unexpectedly short')
    return [dict(language='ko', source='Pokemon official Korea', source_id=value,
                 set_name=name, card_count='', source_url=url,
                 code_type='official search filter value; not a printed code')
            for value, name in parser.products if value and name]


def collect_japanese():
    url = 'https://www.pokemon-card.com/card-search/'
    pattern = r'\{\s*name:\s*"pg",\s*value:\s*("(?:\\.|[^"\\])*"),\s*group:\s*"group-item-name",\s*label:\s*("(?:\\.|[^"\\])*")\s*\}'
    products = re.findall(pattern, fetch(url))
    if len(products) < 50:
        raise ValueError('Japanese official product list unexpectedly short')
    return [dict(language='ja', source='Pokemon official Japan', source_id=json.loads(value),
                 set_name=json.loads(name), card_count='', source_url=url,
                 code_type='official product search filter; not a printed code')
            for value, name in products if json.loads(value)]


def collect_nomad():
    rows = []
    aliases = {'es': 'es-ES', 'es-mx': 'es-419', 'pt': 'pt-BR',
               'zh-tw': 'zh-Hant', 'zh-cn': 'zh-Hans'}
    for language in LANGUAGES:
        suffix = '' if language == 'en' else aliases.get(language, language) + '/'
        url = 'https://pokenomad.com/sets/' + suffix
        parser = NomadSets()
        parser.feed(fetch(url))
        if not parser.items:
            raise ValueError(f'No set entries found: {url}')
        for name, href in parser.items:
            identifier = unquote(href.rstrip('/').split('/')[-1]) if href else ''
            rows.append(dict(language=language, source='PokeNomad', source_id=identifier,
                             set_name=name, card_count='', source_url=url,
                             code_type='website identifier; printed code not verified'))
    return rows


def prior_sources():
    with (ROOT / 'set-code-multilingual-source.csv').open(encoding='utf-8-sig', newline='') as file:
        return [row for row in csv.DictReader(file) if row['source'] != 'TCGdex API']


def deduplicate(rows):
    unique = {}
    for row in rows:
        key = tuple(str(row.get(field, '')) for field in FIELDS)
        unique[key] = row
    return sorted(unique.values(), key=lambda row: tuple(row[k] for k in ('language', 'source', 'source_id')))


def candidates(rows):
    groups = defaultdict(list)
    for row in rows:
        if row['source_id']:
            groups[(row['language'], row['source_id'].casefold())].append(row)
    return [dict(language=language, normalized_id=code,
                 sources=' | '.join(r['source'] for r in group),
                 source_ids=' | '.join(r['source_id'] for r in group),
                 names=' | '.join(r['set_name'] for r in group),
                 status='candidate only; verify identity')
            for (language, code), group in sorted(groups.items())
            if len(group) > 1]


def write_csv(path, fields, rows):
    with path.open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


def main():
    rows = deduplicate(collect_tcgdex() + collect_thai() + collect_korean() +
                       collect_japanese() + collect_nomad() + prior_sources())
    links = candidates(rows)
    write_csv(ROOT / 'set-inventory-sources.csv', FIELDS, rows)
    write_csv(ROOT / 'set-inventory-candidates.csv',
              'language normalized_id sources source_ids names status'.split(), links)
    counts = Counter((row['language'], row['source']) for row in rows)
    report = {'date': date.today().isoformat(), 'source_rows': len(rows),
              'candidate_links': len(links),
              'counts': [{'language': lang, 'source': source, 'rows': count}
                         for (lang, source), count in sorted(counts.items())]}
    (ROOT / 'set-inventory-summary.json').write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
