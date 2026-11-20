# DCR Pokémon Label Workflow (70 × 20 mm)

This guide covers card lookup, label generation, review, and printing while preserving the approved 70 × 20 mm master design.

## 1. Identify a card from an image

For image-based identification, follow [IMAGE-PIPELINE.md](IMAGE-PIPELINE.md). The pipeline uses the local Pokeum API first, then local pHash references, then PaddleOCR and catalog matching. An uncertain or conflicting result must stop for review.

When scan keys are already available, use the local catalog matcher:

~~~powershell
python dcr-tag-70x20/lookup_card.py --scan-json dcr-tag-70x20/examples/mudkip-scan-keys.json
~~~

Use --lookup-only to inspect candidates without generating a label:

~~~powershell
python dcr-tag-70x20/lookup_card.py --scan-json dcr-tag-70x20/examples/mudkip-scan-keys.json --lookup-only
~~~

The matcher reads catalog/cards.sqlite in read-only mode. It generates a mockup only when the printed language, card name, and collector number match. A single clean catalog record can be accepted from a confident exact card name plus complete collector number, including a matching denominator; otherwise it needs independent card details. A clearly read set key must agree with the candidate. Ambiguous printings, high-confidence conflicts, missing rarity mappings, or unsupported label layouts stop before rendering.

Match-report states include:

- matched: one card record matches the scan keys. Check label_ready before generating.
- ambiguous: multiple candidates remain or evidence is insufficient.
- conflict: high-confidence scan keys contradict the catalog.
- no_match: no catalog candidate matches.
- created: a label was generated.
- layout_blocked: preflight found text that does not fit; no label was rendered.
- generation_failed: another renderer or output error occurred.

Exit codes: 0 for success or lookup-only; 2 invalid input; 3 catalog/configuration error; 4 no match; 5 review required; 6 blocked layout or generation failure; 7 output already exists. Existing output folders are never overwritten.

The catalog is a reference source, not proof that a physical card is owned or verified. A curated card JSON is required for direct create_tag.py generation. Keep the full source-language card facts and evidence in the record.

## 2. Multilingual PSA-derived label profiles

psa-label-profiles.json records evidence-backed label wording by language and set:

- Set profiles use language:set_id keys and contain the PSA brand/title reference, DCR tag fields, evidence, and verification status.
- rarity_terms maps normalized catalog rarity names to a PSA Variety/Pedigree term and a DCR rarity code.
- card_labels uses language:TCGdex-card-id keys for card-specific PSA Subject, Variety/Pedigree, DCR rarity, evidence, and status.
- A display name sourced from PSA Subject remains identified as psa_subject; it is not described as an approved abbreviation.
- verified requires a PSA certificate for the same printing and field. partial can use PSA Set Registry evidence for only some fields. draft marks an unconfirmed value.

For non-English cards, lookup stops when a required set profile is missing. When a set profile exists but a card-specific Subject is not confirmed, the English catalog name may be used as a clearly marked draft. Never promote draft or partial to verified without evidence for the exact field.

The current profiles include Japanese, Korean, Thai, and Traditional Chinese SV2a examples and a Thai AS6b example. Some profiles remain partial or draft, and a profile alone cannot match a card missing from the local catalog. See psa-label-profiles.json for the current evidence and limitations. Select another profile file with --psa-profiles when needed.

## 3. Masters, outputs, and generator

- source/dcr-tag-front.svg and source/dcr-tag-back.svg are the editable 70 × 20 mm masters.
- source/a4-40up-portrait.svg is the A4 40-up master.
- preview/ contains view-only previews. They are not print masters.
- create_tag.py reads the single-label masters as read-only and writes a new output folder.
- label_renderer.py is shared by single-label and 40-up generation.
- Generated label output belongs in a new outputs/<job-id>/ directory. Existing output folders are not overwritten.

Install the renderer dependencies:

~~~powershell
python -m pip install -r dcr-tag-70x20/requirements.txt
~~~

Generate a mockup from reviewed card data:

~~~powershell
python dcr-tag-70x20/create_tag.py --card-json dcr-tag-70x20/cards/mudkip-celestial-storm-33.json --mode mockup
~~~

Do not draw labels manually, edit generated SVGs, or reuse a previous card's label as the source. Always render both sides from the current masters.

### Card facts and mockup values

Verify the card name, printed language, set, year, full collector number, rarity, and visible finish against a trusted checklist or source. Record the source URL. Do not infer rarity from shine or price. If the image cannot distinguish a printing, mark that fact unverified and stop before asserting a specific printing.

Mockup mode may create a random condition, DCR test serial, QR payload, and barcode. These values are test data only; they are not a real DCR registration or an assessment of the card. --mockup-condition and --mockup-serial can set fixed test values for repeatable comparisons. Production labels must use an assessed condition and a registry-issued serial.

### Master artwork that must stay intact

| Element | SVG ID | Rule |
| --- | --- | --- |
| Front outer red frame | front-red-frame | Keep the approved color and 70 × 20 mm size. |
| Front white inset | front-white-inset | Keep x=2.30, y=2.30, width=65.40, height=15.40 mm. |
| Front DCR logo | dcr-front-gray-backed-logo | Keep the front artwork; do not use it as the back-left logo. |
| Back-left silver logo | dcr-back-left | Keep the silver/white mark and filter=url(#silver-mark). |
| Six small back watermarks | dcr-mini-top-1..3, dcr-mini-bottom-1..3 | Keep positions, sizes, opacity, and silver filter. |
| Center shield | dcr-center-shield | Keep the back-shield and back-logo artwork. |
| Back QR placeholder | qr-visual-placeholder | Replace only in a rendered copy with a QR generated from the appropriate serial. |

All label text uses normal weight (font-weight=400) and normal letter spacing. Do not move artwork, change transforms, remove filters, or overwrite the master.

## 4. Front label fields

The approved front has seven text fields at 2.570 mm font size. Main text baselines are 3.225 mm apart. The renderer blocks output if the left and right fields overlap or have less than 0.50 mm clearance. Do not shrink individual text fields to make a long value fit.

| Position | SVG ID | Value |
| --- | --- | --- |
| Row 1 left, x=3.40, baseline y=6.30 | front-year-series | Verified release year and era, e.g. 2015 POKÉMON XY. Do not infer a release year from a copyright line alone. |
| Row 1 right, x=66.60, baseline y=6.30 | front-card-number | Printed sequence only, e.g. #88; do not put /162 here. Keep the full number in the registry. |
| Row 2 left, x=3.40, baseline y=9.525 | front-card-name | Printed card name, e.g. CACTURNE. Do not append finish or rarity. |
| Row 2 right, x=66.60, baseline y=9.525 | front-condition | A condition term only, such as GEM MT, MINT, or NM-MT; no numeric grade. Use black #111111. |
| Row 3 left, x=3.40, baseline y=12.75 | front-collection | Full official expansion name, e.g. BREAKTHROUGH. |
| Row 3 right, x=66.60, baseline y=12.75 | front-rarity | Verified DCR rarity code, e.g. C, UC, R, UR, IR, or SIR. |
| Lower strip, x=3.60 visible ink edge, y=13.50, height=3.05 mm | front-barcode-placeholder | Code 128 generated from the same serial shown on both sides. |
| Lower strip, x=66.60, baseline y=15.950 | front-serial | DCR registry serial. Its visible ink is vertically centered in the barcode strip. |

The left-side series and expansion names remain full. If a card name does not fit row 2, use a reviewed display_name_overrides alias keyed by TCGdex card ID. The full canonical name remains in metadata and the card record. If no approved alias fits, keep the output blocked.

### DCR rarity codes

| Code | Meaning |
| --- | --- |
| C | Common |
| UC | Uncommon |
| R | Rare |
| P | Promo, including special promotional sets; retain the source rarity name in the record. |
| DR | Double Rare |
| UR | Ultra Rare |
| IR | Illustration Rare |
| SIR | Special Illustration Rare |
| HR | Hyper Rare |

For older or special rarities such as ACE SPEC, Radiant, Shiny, Prime, LEGEND, and BREAK, preserve the full official rarity in the registry and use only a code defined in the project's rarity rules. Rarity wording varies by language and era; retain the source-language name as well as the DCR code.

Holofoil and Reverse Holofoil are finishes/printing variants, not rarity or card names. Record finish separately when it is known.

## 5. Condition wording

The current DCR condition vocabulary, ordered from highest to lowest, is:

GEM MT · MINT · NM-MT+ · NM-MT · NM+ · NM · EX-MT+ · EX-MT · EX+ · EX · VG-EX+ · VG-EX · VG+ · VG · GOOD+ · GOOD · FR · PR

Use the wording consistently. A printed DCR condition is not a numeric grade and must not imply that PSA inspected or graded the card. For mockups, a condition can be randomly selected from this list only if the output is clearly marked as test data. For a production registry record, inspect the physical card and save an assessment record before printing.

References: [PSA Grading Standards](https://www.psacard.com/gradingstandards), [PSA Lingo](https://www.psacard.com/resources/lingo), and the cert examples linked from those pages.

## 6. Back label and serial codes

The back is fixed except for serial and generated codes:

- Keep the blue background at 70 × 16.15 mm and the full-width white lower strip at y=16.15, height=3.85 mm.
- Keep dcr-back-left at x=4.25, y=5.20 mm with its silver/white filter and all six small watermarks.
- Keep the center shield artwork beginning at x=27.70 mm.
- The QR white frame is 13.30 × 13.30 mm at x=50.55, y=1.35 mm. Keep the black QR artwork boundary and center defined by the master. Do not enlarge the white quiet zone.
- Keep the lower barcode in its measured position, approximately x=3.70, y=16.725 mm, height=2.80 mm.
- Center back-serial at x=57.20 under the QR frame with baseline y=19.125 mm.
- Front and back serials must match exactly.

For a mockup, the QR payload is DCR-TEST:<serial> and the Code 128 barcode encodes the same test serial. For production, both codes must resolve to one registry record and use a registry-issued ID. Never use test serials or payloads for a real card.

If the original QR quiet zone cannot scan, stop and review the master; do not scale the QR or resize its white frame. Verify QR and barcode decoding before releasing a production output.

## 7. Create a new label

1. Read the card image: name, printed language, set symbol/name, collector number, visible year, rarity symbol, and finish. Inspect the full image if any detail is unclear.
2. Verify set year, official expansion, full number, and rarity using a trusted checklist or source for the same language. Record source URLs.
3. Save the verified card facts, full collector number, rarity, finish/variant, assessment status, and source in a card record before rendering.
4. Create a new output directory, such as outputs/<pokemon-set-dcr-tag>/. Never reuse an existing card output folder.
5. Generate both sides from the approved SVG masters. Do not edit a generated label by hand.
6. Use real identity data from the reviewed card record. Use random condition and serial values only for a clearly marked mockup.
7. Export fresh PNGs from the rendered SVG. Do not edit PNGs directly or pair new SVGs with stale previews.
8. Inspect both sides: text fit, #x sequence, rarity, condition color, matching serial, back-left silver logo, physical dimensions, QR, and barcode. Record whether the output is a mockup or production label.

Representative outputs in outputs/ include Cacturne, Cacnea, Treecko δ, and Mudkip. Treat those files as examples only; always start a new job from the current masters and record.

## 8. Export and print

- Keep the SVG as the 1:1 source. A single label exports at 508 dpi, 1400 × 400 pixels.
- Use Edge/Chromium or a renderer that preserves the silver-mark filter. CairoSVG may render the back-left logo incorrectly; inspect the result.
- Preview both sides at 1400 × 400 px. A browser opening the raw SVG may use the viewport's default size, so set the rendering viewport explicitly.
- Print at 100% / Actual Size; disable Fit to page and Shrink to fit.
- Print one test sheet and check physical dimensions, cutting, and front/back alignment before a production run.
- Never use a preview PNG as the print master.

## 9. Build an A4 40-up sheet

The recommended input is a JSON manifest validated by sheet-manifest.schema.json. Pass the current job's manifest explicitly; the repository does not provide a default card lineup.

~~~powershell
$run = Get-Date -Format yyyyMMdd-HHmmss
python dcr-tag-70x20/build_a4_40up.py --manifest "dcr-tag-70x20/manifests/my-40up-sheet.json" --output-dir "dcr-tag-70x20/outputs/a4-40up-portrait-$run" --pdf-output "output/pdf/dcr-tag-a4-40up-front-back-portrait-$run.pdf"
~~~

The portrait master is A4, 210 × 297 mm, with 10 columns by 4 rows of 20 × 70 mm slots; margins are 5 mm left/right and 8.5 mm top/bottom. The manifest must supply all 40 positions, without duplicate card or serial IDs. Front positions are one-based from the top-left. The back sheet mirrors columns for long-edge duplex printing (back_col = 11 - front_col) without flipping each label's artwork.

The builder uses label_renderer.py and places vector labels in memory; it does not need per-card SVG or PNG exports. It creates front/back sheet SVGs, a two-page print PDF, previews, a layout manifest, and a build report in a new output folder. It validates all 40 positions, unique IDs, unique SVG IDs after cloning, and readable QR/barcodes. It also creates 32 short cut-guide marks in page margins and keeps them off the label artwork.

Print the two-sided PDF at 100% / Actual Size with long-edge binding. If the printer cannot print within 5 mm of the left/right page edges, test the physical fit before relying on the sheet layout.

The legacy CSV mode remains available for historic jobs that already have individual label assets.
