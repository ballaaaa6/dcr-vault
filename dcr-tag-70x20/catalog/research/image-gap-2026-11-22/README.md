# Missing-image investigation — 2026-11-22

The inventory is from the local index, not a claim that every available source has been checked. A 404 records the result of the earlier indexed source, not proof the image is absent everywhere. Source links below are search leads unless individual evidence is stated. Image use rights are not established.

| Language | Missing records | Inventory |
| --- | ---: | --- |
| th | 1645 | [th.md](th.md) |
| ja | 2915 | [ja.md](ja.md) |
| ko | 265 | [ko.md](ko.md) |
| zh-tw | 5305 | [zh-tw.md](zh-tw.md) |
| zh-cn | 877 | [zh-cn.md](zh-cn.md) |
| en | 446 | [en.md](en.md) |

Total: 11453 records.

## Verified examples and next checks

- Thai S12-034: [official card detail](https://asia.pokemon-card.com/th/card-search/detail/4570/) shows the Thai name and 034/098; the source list also identifies S12. Check and document actual image usage permission before importing.
- Korean SV4K: [set listing](https://tcgjournal.de/karten/pokemon/koreanisch/sv4k/) includes numbered images; each identity and image must be checked independently.
- Simplified Chinese CSMPiC: [set listing](https://pokemonlore.com/chinese-tcg-cards/csmpic) lists numbered cards and image links; match versions individually.
- [PTCG-database](https://github.com/type-null/PTCG-database) includes Korean, Japanese and Chinese records; image fields can be empty or refer back to TCGdex. Avoid assuming every record has a usable image.
- [CardCorpus dataset](https://github.com/cardcorpus/pokemon-card-dataset) supplies English, Japanese and Simplified Chinese metadata and picture identifiers; image rights differ from dataset licensing.
- [TCGdex image atlas](https://nstrelow.github.io/ptcg-image-atlas/) explicitly labels its analysis unverified: treat it only as a source-discovery lead.

No images were downloaded or added to the library during this investigation.

## Korean metadata comparison

Compared 239 missing rows in SV4K, SV4M and SV5K against PTCG-database `main` (commit `18e0de2feb7a35ebe4296ede0ba6cc768961489b`). 232 records have matching Korean name and collector number plus a nonempty image URL in source metadata. The links are in ko.md and full candidate data is in ko-source-matches.json. The remote images, set equivalence, printing/variant and reuse rights have not been individually verified; 7 comparisons did not meet these checks. B2a was not included.
