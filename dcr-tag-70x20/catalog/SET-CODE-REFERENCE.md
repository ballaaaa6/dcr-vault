# Pokémon set code reference

This is a research inventory for the future card-identification work, not an approved automatic matching table. It does not change the app or label rules. Snapshot date: 2026-11-22.

## Files and coverage

- [Set inventory CSV](set-code-reference.csv): one row per language and catalog set ID, plus English reference-only sets. UTF-8 with BOM for Excel. Filter `language`, `catalog_set_name`, `catalog_set_id`, or `ptcgo_decklist_code`.
- [English source snapshot](set-code-english-source.json): names, IDs, and PTCGO/deck-list codes from the pinned source below.
- [Builder](build-set-code-reference.py): regenerates the CSV from the shipped card index and the pinned English source snapshot. It does not fetch data or change the card catalog.

The CSV contains 528 rows: en 262, ja 131, ko 11, th 32, zh-cn 8, zh-tw 84. It includes 146 rows with an English PTCGO/deck-list code. These counts describe these snapshots only: they do not establish complete coverage of any language. Indonesian, French, German, Spanish, Italian, Portuguese, Dutch, Polish, and Russian are not represented by the shipped source catalog. Japanese promo data and Thai MA6 are among known gaps. Add source material and verify it before claiming complete coverage.

`catalog_set_id` is an internal TCGdex ID, not proof of a marking on a particular card. `ptcgo_decklist_code` is an external game/deck-list abbreviation, not automatically a printed code. `printed_code` is deliberately blank and `printed_code_status` is `unverified` throughout: neither input source establishes printed markings per language and printing. A blank is unknown, not evidence that there is no code. Preserve multiple rows per code; do not construct a one-to-one dictionary.

## What goes in Set

Use the full name for the **actual printed-language release**, in the agreed English display name where a verified name is available. Keep the series, source-language name, catalog ID, printed code or symbol, collector number, and promo designation in separate fields. The card's original collector number must not be replaced by a number from a different-language counterpart.

Example: `Sword & Shield—Brilliant Stars` is the full set display, `swsh9` is a TCGdex catalog identifier, and `BRS` is an English deck-list abbreviation. The official [Pokémon deck list](https://asia.pokemon-card.com/ph/wp-content/uploads/sites/6/2022/12/Blank-Decklist-Template.pdf) associates BRS with Brilliant Stars. **Do not assume BRS is printed on English Sword & Shield cards**: those cards generally use an expansion symbol; modern English Scarlet & Violet cards use printed codes. See the official [Pokémon card-parts diagram](https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/rulebook/sm4_rulebook_en.pdf) and [code-era reference](https://dinostcg.com/tools/set-code-finder). Confirm the actual print before resolving it.

BRS also appears for `swsh9tg` (Brilliant Stars Trainer Gallery) in the English source. The set code alone cannot choose a specific card or subset. Match the language, collector number, set symbol/code and other non-conflicting evidence. The CSV names are source names, not automatically approved PSA/DCR label text.

## Promo and special collections

- An English Black Star Promo should use its verified era-specific collection, e.g. `Sword & Shield Black Star Promos`, and retain its printed number such as `SWSH001`. A generic `Promo` alone is a category, not a unique collection.
- A Japanese number such as `151/XY-P` should be preserved whole. `XY-P` is a promo-series marker; do not interpret it as the numeric denominator of a standard `168/130` collector number. Treat `XY-P Promos` as an unverified display suggestion until the exact card and collection have been checked against a source.
- `Promo`, rarity, distribution event, stamp, finish, and subset are separate concepts. A promo marker does not by itself identify an event, rarity, or holo variant. Do not borrow a set or number from a similar English reprint.
- For products with no confidently identified release, keep Set unresolved and show candidates or request review. Do not derive a release year from the copyright year.

## How to complete the reference safely

1. Collect set and card lists from authoritative publisher sources or well-documented catalogs for each language and region; record source URLs, dates, license, and version. Regional release sets are not necessarily one-to-one with English sets.
2. For each language and era, verify actual card images or official checklists for printed codes, symbols, promo number formats, and exceptions. Record evidence and verification status per mapping; never infer printed codes from catalog IDs alone.
3. Preserve aliases, ambiguous codes, set/subset relationships, language/region, release dates, and source-specific names. Add reviewed equivalence links only where supported, not by similar artwork.
4. Add fixtures covering symbol-only older cards, printed modern codes, leading zeroes, promos, shared codes, and mismatched years. Identify an exact card using multiple evidence fields; a set mapping alone cannot prove a printing or finish.
5. Include the missing languages and refresh snapshots as sets are released. Review source terms and data quality before redistribution or use in production.

## Sources

- Shipped card catalog: TCGdex snapshot commit `4218f64dcbf3de6e7b7548530f938fb0b9ebbe2a`, [source](https://github.com/tcgdex/cards-database/tree/4218f64dcbf3de6e7b7548530f938fb0b9ebbe2a). The catalog contains card rows, so sets with no imported cards are absent.
- English reference: [Pokemon TCG data, pinned set list](https://github.com/apitcg/pokemon-tcg-data/blob/60ddcd44dea63e2b960d516356815aaa937d8196/sets/en.json). `ptcgoCode` is treated as an abbreviation, not proof of printed text. Additional English set IDs do not imply their cards exist in the app catalog.
- Thai Charizard 168/130 example: [SASOM listing](https://sasom.co.th/th/collectibles/MA6T-168-130/pokemon-charizard-ma6-168-130-30th-celebration-th). This listing supports MA6 / 30th Celebration as a research lead; it is not an exhaustive source for all Thai sets or an automatic card match.
