#!/usr/bin/env python3
"""Publish source URLs for downloaded image-library records, without the image files."""
import json
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
DATABASE = ROOT / 'dcr-tag-70x20/catalog/card-image-library/image-index.sqlite'
OUTPUT = ROOT / 'public/data/card-image-sources.json'
HOSTS = {'assets.tcgdex.net', 'img.cardcorpus.com', 'images.pokemontcg.io', 'img.tcgcardprice.com'}


def main():
    sources = {}
    with sqlite3.connect(f'{DATABASE.as_uri()}?mode=ro', uri=True) as connection:
        rows = connection.execute("""SELECT language, api_id, cached_image_url FROM card_images
            WHERE status IN ('downloaded', 'cached_set_api_error') AND cached_image_url IS NOT NULL
            ORDER BY language, api_id""")
        for language, card_id, url in rows:
            parsed = urlsplit(url)
            if parsed.scheme != 'https' or parsed.netloc not in HOSTS:
                continue
            if parsed.netloc == 'assets.tcgdex.net':
                url = url.rstrip('/') + '/low.webp'
            sources[f'{language}:{card_id}'] = url
    OUTPUT.write_text(json.dumps(sources, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Exported {len(sources)} image source URLs to {OUTPUT}')


if __name__ == '__main__':
    main()
