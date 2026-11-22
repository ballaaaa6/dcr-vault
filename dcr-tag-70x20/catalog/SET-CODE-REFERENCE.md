# Pokémon set code reference

## Set name and code index

[Thai official card and mark samples](thai-official-mark-samples.csv) links all 83 official Thai product search filters to one returned card and its official set-mark image. This establishes the search result and mark image for the sampled card, not every card in the product, and does not transcribe the image. Refresh with `python dcr-tag-70x20/catalog/refresh-thai-official-marks.py` after refreshing the source inventory.

[Japanese, Korean and Traditional Chinese official mark inventory](official-card-mark-inventory.csv) groups 58,745 archived card records into 725 language, source-identifier and official-mark-image combinations, each with an official sample card link. Candidate names are joined by identical TCGdex IDs and require review; group counts and source identifiers do not prove printed text. Rebuild with `python dcr-tag-70x20/catalog/build-official-mark-inventory.py archive/source-packages/ptcg-database-18e0de2feb7a35ebe4296ede0ba6cc768961489b.zip`. The input is the locally retained, user-provided source archive and is not included in this inventory.

[English code source snapshot](english-set-code-source.csv) adds 190 English set-name/code records, including the source's distinction between a code it reports on cards, a shorthand not reported on cards, and unconfirmed cases. It includes 25 records reported as on-card codes. These are third-party assertions, not independent card-by-card verification; preserve repeated codes for subsets. Refresh with `python dcr-tag-70x20/catalog/refresh-english-set-codes.py`. Source: [Dino & Dino TCG set code finder](https://dinostcg.com/tools/set-code-finder).

[Set name and code index](set-name-code-index.csv) provides one source-qualified row per inventory record, with separate columns for source ID, English deck-list abbreviation, and verified printed code. Empty printed-code fields are unknown, not evidence of absence. Source IDs and abbreviations must not be substituted for physical marks. The same set may appear in multiple source rows. The index contains 115 English deck-list abbreviation rows and one reviewed printed-code row as of this snapshot; it is not a complete printed-code catalog. Rebuild it with `python dcr-tag-70x20/catalog/build-set-name-code-index.py` after refreshing the sources or reviewed mappings.

## Source reconciliation snapshot (2026-11-22)

Official product-search snapshots now also include Indonesia (94 filters), Taiwan and Hong Kong (136 each), Singapore, Malaysia and the Philippines (46 each), Japan's default card-search view (89 filters), and Korea (563 distinct filter records). These are product search options, including promos, decks, and potentially broad category filters, not totals of distinct collections. Japanese numeric `pg` IDs and Korean product-name filters are not printed codes. Regional options are kept separately even when identical. Japan's default view is not evidence of complete historical coverage. The underlying pages and dates are recorded per row in the inventory and summary.

[Source inventory](set-inventory-sources.csv) refreshes TCGdex and [PokéNomad](https://pokenomad.com/sets/) set lists for 16 language/region codes, adds all 83 product search codes and names published on the official Thai card search page, and preserves the previous Japanese and Thai research sources. [Candidate overlaps](set-inventory-candidates.csv) groups matching identifiers within each language, including duplicate identifiers within a source. These are **review candidates**, not confirmed equivalences or printed codes. For example, TCGdex reports two different Japanese names under `BW3a`; both are retained. Exact duplicate source records are removed; conflicting records are not discarded. The [summary](set-inventory-summary.json) reports source row counts, not distinct collection totals.

The official Thai page calls these product search filters, which include decks and promos; their values do not independently verify markings on physical cards. In this snapshot, 57 of the 83 official Thai identifiers also appear in TCGdex ignoring case. This is a lead, not proof of an exact match. The source lists have different scopes and cannot establish completeness by adding their counts. Japanese official products, promotions and older symbols and independent checks for other languages still need reconciliation. This inventory is not connected to automatic identification or approved label mappings.

To refresh, run `python dcr-tag-70x20/catalog/refresh-set-inventory.py` from the project root. It fetches the live TCGdex, PokéNomad, and official regional lists before writing the outputs, and retains the other sources from the earlier CSV. PokéNomad identifiers are URL slugs and unlinked entries have no ID; its collection scope and regional groupings can differ from the other sources. The `es-mx` and `pt` rows represent Latin American Spanish and Brazilian Portuguese respectively for PokéNomad, and are not proof that regional editions are identical across sources. Check provider terms before redistribution or commercial reuse of source data. Source: [official Thai card search](https://asia.pokemon-card.com/th/card-search/); [TCGdex](https://tcgdex.dev/); earlier source details below.

This is a research inventory for the future card-identification work, not an approved automatic matching table. It does not change the app or label rules. Snapshot date: 2026-11-22.

## Files and coverage

- [Set inventory CSV](set-code-reference.csv): one row per language and catalog set ID, plus English reference-only sets. UTF-8 with BOM for Excel. Filter `language`, `catalog_set_name`, `catalog_set_id`, or `ptcgo_decklist_code`.
- [English source snapshot](set-code-english-source.json): names, IDs, and PTCGO/deck-list codes from the pinned source below.
- [Builder](build-set-code-reference.py): regenerates the CSV from the shipped card index and the pinned English source snapshot. It does not fetch data or change the card catalog.

The CSV contains 528 rows: en 262, ja 131, ko 11, th 32, zh-cn 8, zh-tw 84. It includes 146 rows with an English PTCGO/deck-list code. These counts describe these snapshots only: they do not establish complete coverage of any language. Indonesian, French, German, Spanish, Italian, Portuguese, Dutch, Polish, and Russian are not represented by the shipped source catalog. Japanese promo data and Thai MA6 are among known gaps. Add source material and verify it before claiming complete coverage.

`catalog_set_id` is an internal TCGdex ID, not proof of a marking on a particular card. `ptcgo_decklist_code` is an external game/deck-list abbreviation, not automatically a printed code. `printed_code` is deliberately blank and `printed_code_status` is `unverified` throughout: neither input source establishes printed markings per language and printing. A blank is unknown, not evidence that there is no code. Preserve multiple rows per code; do not construct a one-to-one dictionary.

## Expanded multilingual source list (2026-11-22)

[Expanded source list CSV](set-code-multilingual-source.csv) contains 2,191 source rows, preserving multiple source entries rather than merging ambiguous codes. TCGdex API supplied 221 English, 204 Japanese, 72 Thai, 95 Korean, 98 Traditional Chinese, 57 Simplified Chinese, 70 Indonesian, 203 French, 156 German, 160 Spanish, 194 Italian, 126 Portuguese, 3 Dutch, 2 Polish and 9 Russian entries. One additional Thai MA6 row comes from SASOM. The Japanese list also includes 520 source entries from [TCG Collection Tracker](https://github.com/Silencx/Tcg-Collection-Tracker/blob/3ccccb280a2985b15a50a5d84b07604def2023e1/data/jp-cat/sets.json), which credits PokéWallet. Its source code repository is MIT licensed; verify underlying source terms before reuse beyond this research inventory.

The lists are snapshots taken on 2026-11-22, not a claim of full historical or printed-code coverage. `source_id` is the identifier reported by each source, and is not automatically a printed marking. Check language, name, symbol and collector number before matching. Blank or duplicate identifiers must not be treated as unique. Source entries may contain outdated, missing or overlapping sets. TCGdex API URLs in each row identify the corresponding live source, which can change after the snapshot. MA6 identifies a researched Thai set, not evidence that every card's printed code has been inspected.

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
