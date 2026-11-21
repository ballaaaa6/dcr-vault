# TCGdex local catalog

For set IDs, English deck-list abbreviations, promo formats, and current coverage limits, see the [set code research reference](SET-CODE-REFERENCE.md).

`cards.sqlite` is the local, searchable snapshot of the TCGdex multilingual source database. It contains all static fields present in each imported source record; optional or untranslated fields remain absent. Card-art files are kept outside the SQLite snapshot in the optional `layout-references/` library.

## Imported snapshot

- Source: [`tcgdex/cards-database`](https://github.com/tcgdex/cards-database), MIT license.
- Imported commit: `4218f64dcbf3de6e7b7548530f938fb0b9ebbe2a`.
- Languages indexed: English (`en`), Thai (`th`), Korean (`ko`), Traditional Chinese (`zh-tw`), Simplified Chinese (`zh-cn`), and Japanese (`ja`).
- The `cards.raw_json` and `sets.raw_json` columns retain source fields without flattening away nested variants, card text, third-party reference IDs, or fields this label workflow does not currently use.
- `card_locales` provides fast lookup by printed card name, set, and collector number. Its source rows can be incomplete; inspect `raw_json` before treating a record as verified label data.
- `api_enrichment` is reserved for per-card API responses such as dynamic market pricing. It is empty in the bulk import because prices are not part of the source snapshot and fetching them for every card would require tens of thousands of requests. Third-party reference IDs remain in the source JSON.
- `cards/` remains the curated, verified input for `create_tag.py`. Do not generate a label directly from an unreviewed catalog result.

## Layout reference library

`build_layout_references.py` uses the local catalog to select one anchor card per localized set plus a small number of Trainer, Energy, and special-Pokémon examples per series. It fetches only those records from the TCGdex API, downloads available card/set images into `layout-references/images/`, and writes a manifest, contact sheets, and series-grouping suggestions. Missing images are recorded in the manifest and do not block the build.

```powershell
python dcr-tag-70x20/catalog/build_layout_references.py
```

The library is a maintenance-time reference. The scan pipeline reads local profiles from `layout-profiles.json`, but applies only entries marked `pilot` or `calibrated`; it does not call the TCGdex API during card scans. `layout-profile-suggestions.json` groups samples by upstream series ID and remains advisory until its image layouts have been reviewed and calibrated.

The current manifest contains 576 selected samples across six languages. Card images are available for 348 samples (60.4%); availability varies by language, so an absent image must stay an unknown layout rather than being inferred from a neighboring language:

| Language | Available | Selected |
| --- | ---: | ---: |
| English (`en`) | 204 | 264 |
| Japanese (`ja`) | 35 | 154 |
| Korean (`ko`) | 0 | 16 |
| Thai (`th`) | 29 | 38 |
| Simplified Chinese (`zh-cn`) | 0 | 14 |
| Traditional Chinese (`zh-tw`) | 80 | 90 |

These are snapshot counts, not coverage guarantees; check `layout-references/manifest.json` after refreshing the library. A successful reference build can still contain missing card images, and those records are reported rather than silently filled from another print or language.

## Complete card-image library

The layout library above intentionally downloads only a small set of examples. To cache a low-resolution image for every catalog card that TCGdex currently exposes, run:

```powershell
python dcr-tag-70x20/catalog/card_image_library.py sync
```

The sync reads the local catalog, fetches each localized set record once to get its card image URLs, downloads `low.webp`, and stores a 64-bit DCT perceptual hash (pHash) beside the image metadata. TCGdex low-resolution card assets are 245 × 337 pixels. If a set endpoint or card image URL is absent, it also tries the deterministic card path on the TCGdex asset CDN using the catalog's language, series, set, and local card number. The index records whether each cached file came from the API URL or this direct CDN fallback.

The process saves progress to `card-image-library/image-index.sqlite` and `manifest.json`; rerunning the same command resumes failed downloads, skips known 404s for unchanged URLs, and skips images already cached from the API or direct CDN URL. It uses 32 parallel downloads by default and supports `--workers 1` to reduce CDN requests or values up to 32 to increase throughput. `requests` enables HTTP keep-alive for faster bulk syncs; the downloader still works with Python's standard library if that optional optimization is unavailable.

Downloaded files live under `catalog/card-image-library/images/<language>/<set>/<card-id>.webp`. The generated folder ignores the image files and SQLite index in Git; the source script and this documentation remain reviewable. Rows for which neither the API URL nor the direct CDN path succeeds, HTTP 404s, and transient errors remain separately counted in the manifest instead of being silently treated as downloaded. The WebP files retain the original low-resolution image data; pHash is only a compact search index and is not a replacement for the images.

To rank local references against a card-face image, crop and straighten the input first, then run:

```powershell
python dcr-tag-70x20/catalog/card_image_library.py search path\to\card.png --language en --limit 10
```

The standalone `search` command checks four rotations and only prints nearest pHash candidates for manual review. The `pipeline/image_to_label.py` default strategy uses the same local index first: if the top match is within 8 bits and at least 4 bits ahead of the runner-up, it selects that localized card record from the catalog directly and skips OCR. If those gates fail, it falls back to OCR. The index can be searched without a network connection after the images are cached.

To export catalog-grounded text truth and image provenance for later layout annotation, run:

```powershell
python dcr-tag-70x20/catalog/build_layout_training_index.py
```

The export deliberately marks layout boxes and text roles as unannotated until they are reviewed. See [the survey and calibration plan](layout-references/layout-survey-2026-10-20.md) and the [Wurmple XY6 parser regression case](layout-references/failure-cases/wurmple-xy6-3-20261020.json).

## Web-app search index

The web app builds a small metadata-only suggestions asset from this snapshot. Run `python tools/build-card-catalog-index.py` after importing the pinned source snapshot. It writes `public/data/card-catalog.json` with card names, set names, release years, collector numbers, language codes, rarity, and series/set IDs and names. Add Card resolves the source-language printing and its English catalog counterpart. The read-only rarity field is filled from that exact English card record, or from a source-verified uniform set default when its rarity is missing. The web picker loads low-resolution artwork through a same-origin catalog image route; the offline image cache remains outside the web bundle.

### Set rarity reference

Rarity is a fixed property of the selected English catalog card; Add Card does not ask the user to choose it. A source-verified uniform set default can fill cards whose individual catalog rarity is missing. Other missing values stay blank. Overrides include their evidence URL and review date. Use `noPrintedRarity: true` with an empty `rarities` list when an exact-print source confirms no rarity is recorded. Do not infer rarity from artwork, finish, price, or a different printing. The label renderer separately maps the recorded English rarity to a supported DCR code using `catalog-label-rules.json`; an unsupported mapping blocks the label until an explicit rule is reviewed.

Year / series metadata uses an exact set override first, then the English catalog series ID in `catalog-label-rules.json`'s `series_labels`. It does not use the upstream display series name as a label value. If no approved series mapping exists, leave the field unavailable until an exact rule is reviewed. English card and expansion names come from the English catalog; verified non-English PSA profiles supply their reviewed English label wording.

Regenerate the readable per-set list with `python dcr-tag-70x20/catalog/build_rarity_reference.py`. Review the “No rarity recorded” sets against sources for the exact print before adding any override.

To select a small, varied set of local card images for parser/layout annotation, run:

```powershell
python dcr-tag-70x20/catalog/build_parser_sample_set.py
```

This writes `layout-references/parser-sample-set.json` with exact catalog text, image paths, checksums, and review focus tags. This generated local index is ignored by Git. The samples are not training data until their image regions and text roles are reviewed.

## Search example

```sql
SELECT l.card_name, l.language, l.set_id, l.local_id, l.set_name,
       l.release_date, c.rarity, c.illustrator, c.raw_json
FROM card_locales AS l
JOIN cards AS c USING (source_path)
WHERE l.language = 'en'
  AND l.card_name LIKE '%Mudkip%'
ORDER BY l.set_id, l.local_id;
```

The primary identity should include language, set ID, and local card number. Source path is retained as the stable source-record key, including when multiple source records share a printed set/number.

## Refresh

Install the pinned TypeScript parser dependency and import the latest upstream snapshot:

```powershell
npm ci --prefix dcr-tag-70x20/catalog
python dcr-tag-70x20/catalog/import_tcgdex_catalog.py
```

The importer downloads a commit-pinned GitHub archive, parses only TypeScript object literals (it does not execute upstream data files), writes a replacement SQLite database, and swaps it into place after the import completes. To import a local checkout instead, pass `--source-dir` and `--source-commit`.
