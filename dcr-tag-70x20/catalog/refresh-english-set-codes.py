"""Capture source-reported English set codes and their on-card status."""

import csv
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

URL = 'https://dinostcg.com/tools/set-code-finder'
ROOT = Path(__file__).resolve().parent


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.row = None
        self.cell = None
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        elif tag in ('th', 'td') and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('th', 'td') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if len(self.row) == 6 and self.row[-1] in ('Yes', 'No', 'Not confirmed'):
                self.rows.append(self.row)
            self.row = None


def main():
    parser = TableParser()
    with urlopen(Request(URL, headers={'User-Agent': 'DCR-Vault-Research/1.0'}), timeout=40) as response:
        parser.feed(response.read().decode('utf-8'))
    if len(parser.rows) < 150:
        raise ValueError('Unexpectedly short source table')
    with (ROOT / 'english-set-code-source.csv').open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['code', 'set_name', 'series', 'release', 'card_count', 'source_reports_on_card', 'source_url'])
        writer.writerows([*row, URL] for row in parser.rows)
    print(f'{len(parser.rows)} source rows; {sum(r[-1] == "Yes" for r in parser.rows)} reported printed')


if __name__ == '__main__':
    main()
