# DCR Pokémon Label Toolkit

This folder contains the current local-first card lookup and DCR label-generation workflow.

## Workflow

1. When given a card image, run the default image-to-label pipeline. It checks the configured local Pokeum service, then a local pHash reference library, then OCR and catalog recovery.
2. Accept an identity only when it passes the configured evidence gates and resolves to a local catalog record. Uncertain, conflicting, or incomplete evidence requires review.
3. Generate labels only from a reviewed card record. The catalog is a metadata reference and is not itself proof that a printing or physical card is verified.
4. Inspect both rendered sides and the saved evidence before treating an output as production-ready.

Read the [image-to-label guide](IMAGE-PIPELINE.md), [production workflow](WORKFLOW.md), and [catalog guide](catalog/README.md).

## Key files

- create_tag.py: renders one front/back label pair from a card JSON.
- label_renderer.py: shared card-to-SVG renderer.
- build_a4_40up.py: creates duplex A4 sheets from a data manifest.
- lookup_card.py: matches scan keys to the local SQLite catalog and optionally generates a label.
- catalog-label-rules.json: series, rarity, and display-name rules.
- psa-label-profiles.json: evidence-backed multilingual label wording.
- sheet-manifest.schema.json: A4 40-up input schema.
- source/: editable single-label and sheet masters.
- preview/: view-only master previews.
- cards/: curated card-definition examples; included unless an example contains copy-specific identifiers.
- outputs/, lookup-results/, scan-results/, and catalog databases: local data and generated artifacts; excluded from the public repository.

## Install and run

Install label renderer dependencies from the workspace root:

~~~powershell
python -m pip install -r dcr-tag-70x20/requirements.txt
~~~

Generate a mockup from reviewed card JSON:

~~~powershell
python dcr-tag-70x20/create_tag.py --card-json dcr-tag-70x20/cards/<reviewed-card>.json --mode mockup
~~~

Run image identification from a local image:

~~~powershell
python dcr-tag-70x20/pipeline/image_to_label.py "C:\path\to\card.png"
~~~

Use --lookup-only if the user requests identification without label generation.

## Data and safety

- The pipeline uses the local catalog and image cache for lookup. Scans are sent only to the configured loopback Pokeum API when that integration is enabled.
- The pipeline preserves OCR, matching, timing, and fallback evidence in a local scan-results folder.
- Mockup condition, serial, QR payload, and barcode are test data and do not create a real DCR registration.
- Card names and printed text remain in their original language. Documentation and interface text use English.
- Do not replace an existing output directory; create a new output for each job.
