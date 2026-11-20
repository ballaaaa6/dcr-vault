# Image-to-label pipeline (local)

`pipeline/image_to_label.py` accepts one card image and tries the local Pokeum service first, then local pHash, then PaddleOCR. Pokeum can select a catalog record only when the configured encoder index is ready (DINOv2 ONNX when installed, otherwise `histogram-v1`), its near-complete index is ready, its result clears the confidence/margin gates, and the complete identity agrees with our local SQLite catalog. A Pokeum miss or service problem falls through to the existing pHash and OCR routes. The image is sent only to `127.0.0.1`; catalogue/model downloads happen during explicit Pokeum setup.

## Runtime setup

The card-label dependencies are listed in `requirements.txt`. PaddleOCR/PaddlePaddle is installed in a separate Python environment and is only needed on the OCR fallback path. Set `DCR_PADDLE_PYTHON` to that Python executable when OCR fallback is needed; the pipeline also checks the existing `.tmp/image-ocr-eval/paddleocr-env` developer environment as a local fallback.

Pokeum runs as a separate Python 3.13 local service. The default integration expects its checkout at `.tmp/pokeum-eval`, data/index at `.tmp/pokeum-data`, an optional DINOv2 model at `.tmp/pokeum-eval/data/models/dinov2s-ft-v1.onnx`, and the API at `http://127.0.0.1:8765`. If the ONNX file is unavailable, Pokeum builds and uses its built-in `histogram-v1` fallback. The start helper verifies the index metadata and catalogue coverage, then refuses a port conflict instead of selecting another port. Set `DCR_POKEUM_URL` to another loopback port, `DCR_POKEUM_DATA_DIR`, `DCR_POKEUM_MODEL_PATH`, `DCR_POKEUM_EXPECTED_EMBEDDER_ID`, `DCR_POKEUM_LANGUAGE`, `DCR_POKEUM_MIN_CATALOG_COVERAGE`, or `DCR_POKEUM_TIMEOUT_SECONDS` to override the integration settings.

When the ONNX release asset is available, place the model before building the index; otherwise use the histogram fallback. The integration requires matching index metadata and near-complete reference data, so a small or degraded Pokeum database cannot make a confident guess from a partial catalogue.

Prepare the English catalogue and build its index with the available encoder:

```powershell
$PokeumRoot = (Resolve-Path '.tmp/pokeum-eval').Path
$PokeumData = (New-Item -ItemType Directory -Force '.tmp/pokeum-data').FullName
$ModelPath = Join-Path $PokeumRoot 'data/models/dinov2s-ft-v1.onnx'
$env:DATA_DIR = $PokeumData
$env:EMBED_MODEL_PATH = $ModelPath
& "$PokeumRoot/.venv/Scripts/python.exe" "$PokeumRoot/main.py" --data-dir $PokeumData sync
& "$PokeumRoot/.venv/Scripts/python.exe" "$PokeumRoot/main.py" --data-dir $PokeumData index build --full
& 'dcr-tag-70x20/pipeline/start_pokeum.ps1' -PokeumRoot $PokeumRoot -DataDir $PokeumData -ModelPath $ModelPath
```

The final command runs the service in the foreground; stop it with Ctrl+C. If the ONNX model is absent, the index and service use Pokeum's built-in `histogram-v1` encoder. The workflow still applies the confidence, margin, exact-catalogue, pHash, and OCR safeguards.

The matcher and label generator use the Python interpreter that launches `image_to_label.py`. That interpreter must have the dependencies from `requirements.txt`, including `zxing-cpp`.

## Run

```powershell
$env:DCR_PADDLE_PYTHON = 'C:\path\to\paddle-env\Scripts\python.exe'
python dcr-tag-70x20/pipeline/image_to_label.py 'C:\path\to\card.png'
```

Use `--lookup-only` to inspect image matching and catalog lookup without creating a mockup. Use `--strategy ocr-first` to run the previous OCR-first flow. The first OCR fallback includes Paddle model initialization; a web service should keep its OCR worker warm to avoid paying that cost for every fallback.

The catalog language defaults to English. For another clearly identified card language, pass `--language th`, `ko`, `zh-tw`, `zh-cn`, or `ja`. The private Oracle service passes `--language auto`, so the parser selects a catalog language from the script it reads. PaddleOCR remains the first reader; if it exits, times out, or returns invalid output, `tesseract_reader.py` can provide OCR lines in the same format using the host's `tesseract-ocr` and `tesseract-ocr-tha` packages. Its separate title-band pass preserves split Thai glyphs. Catalog matching accepts one clean record when the confidently read name and complete collector number, including its denominator, match; otherwise independent card details are still required.

The standard one-image entry point is Pokeum-first. The pipeline checks Pokeum readiness and sends the image to the loopback API. A candidate is accepted only when Pokeum reports `confident`, its confidence is at least 0.80, its margin over the runner-up is at least 0.10, and its ID/name/set/full collector number agree with the local catalogue. The local catalog row supplies the metadata for the label. PaddleOCR is skipped on this path.

Pokeum does not get to select from an incomplete index. The integration requires the configured encoder to match the index metadata, at least 95% overlap of TCGdex card IDs with the local catalog, a healthy service, and the same language. This measures shared identities rather than comparing row totals. If any readiness check fails, Pokeum is recorded as not ready and the workflow moves on. Local image matching then checks four rotations against the cached 64-bit pHash index. Its operational gates remain 8 bits maximum distance and a 4-bit runner-up gap; a distant match, close tie, cache miss, catalog miss, or incomplete number falls through to OCR. The pHash thresholds are adjustable with `--image-match-max-distance`, `--image-match-min-gap`, and `--image-match-limit`.

Use `--disable-pokeum` to bypass Pokeum while keeping pHash and OCR. Use `--disable-image-recovery` to skip Pokeum and all pHash matching, forcing OCR-first. PHash matching reads the cached `catalog/card-image-library/image-index.sqlite` and local `cards.sqlite` in read-only mode. Pokeum status, response, readiness checks, confidence, and timing are stored in `pokeum-result.json`; the selected catalog ID and field origins are retained in `field-evidence.json`, `scan-keys.json`, and `pipeline-result.json`. `raw-ocr.json` is absent when the selected fast path did not invoke PaddleOCR.

To reinterpret a saved OCR result after changing the parser, use `--from-raw-ocr`. This copies the saved OCR JSON into a new scan run and skips the PaddleOCR process:

```powershell
python dcr-tag-70x20/pipeline/image_to_label.py --from-raw-ocr 'dcr-tag-70x20/scan-results/<run-id>/raw-ocr.json' --lookup-only
```

When the matcher reports an attacks-only conflict for one exact name/number candidate, the pipeline first checks whether every catalog attack name has one exact matching OCR line and at least two independent card details corroborate that candidate. If so, it reclassifies the already-read OCR lines against that exact catalog record; it does not invoke OCR again. Extra lines are excluded from the attack list and retained with the reason in field evidence. It retries lookup without generating a label first, and only generates after the same exact candidate validates with no remaining conflict. If the exact text anchors are incomplete or ambiguous, the pipeline falls back to the older conservative geometry rule; otherwise it leaves the card as `review_required`.

Layout profiles in `catalog/layout-profiles.json` are applied only when marked `pilot` or `calibrated`. The former `en:xy` pilot is now `reference_only`: it was based on Vespiquen alone and was too broad to apply across the XY series. Profile suggestions based on `language:series_id` remain hints until image-based layout families have reviewed examples and holdout results.

Sample images are gathered separately with `catalog/build_layout_references.py`; a smaller, balanced parser review set can be selected with `catalog/build_parser_sample_set.py`. The sample set records exact catalog truth, paths, checksums, and review focus, but is not supervised training data until line roles and image regions are reviewed. During a scan, card images go only to the loopback Pokeum API; other catalogue and profile lookups remain local. TCGdex access is limited to explicit Pokeum sync during setup.

## Results and safety

Each run creates `scan-results/<run-id>/` with raw OCR JSON, field-level evidence (including confidence and image coordinates), normalized scan keys, process logs, the local matcher report, timing data, and `pipeline-result.json`.

The run order is:

| Step | Action | If it cannot confirm the card |
| --- | --- | --- |
| 1 | Pokeum checks its configured encoder index and full-catalog coverage, then ranks the image through the local API. | Not ready, uncertain, malformed, or conflicting output proceeds to pHash. |
| 2 | A confident Pokeum candidate is checked against the exact local card ID, language, set, name, and complete collector number. | Any mismatch proceeds to pHash; Pokeum candidates never fill scan keys manually. |
| 3 | If Pokeum cannot be accepted, pHash ranks cached card images in four rotations using the existing distance/gap gates. | A distant match, close runner-up, missing image, or incomplete catalog row proceeds to OCR. |
| 4 | If image evidence did not pass, local PaddleOCR reads the full image and enlarged footer crops, then the parser and text matcher try the OCR-first route. | Keep OCR output and coordinates for review; unresolved identity stays at `review_required`. |
| 5 | `lookup_card.py` verifies catalog identity and label readiness; `create_tag.py` renders front/back mockups and decodes QR/barcodes. | A conflict, ambiguous printing, layout error, or generation error preserves diagnostics and does not create or replace a label. |

Pipeline statuses users will see:

| Status | Meaning |
| --- | --- |
| `label_created` | Identity passed and mockup files were generated. |
| `matched_preview` | `--lookup-only` matched the card without generating a mockup. |
| `review_required` | Identity evidence was incomplete, conflicting, or ambiguous. |
| `no_match` | No catalog record matched the image/OCR evidence. |
| `configuration_error` / `ocr_error` | Local OCR runtime or input needs attention. |
| `generation_failed` / `layout_blocked` | Card matched, but the label renderer could not safely produce the output. |
| `output_exists` | That card's output folder already exists; it was left untouched. |

Attack evidence keeps OCR text-recognition confidence separate from parser role confidence, so a clearly recognized sentence is not automatically treated as an attack name. Reinterpretation preserves the raw OCR input and records the chosen parser mode in field evidence.

When Pokeum and the local image path both fall through to OCR, the collector number can come directly from OCR when a full `number/total` is read confidently. If OCR only finds a weak footer fragment or misses the number, the OCR route tries two evidence routes in order:

1. **Text-only catalog recovery:** the confidently read card name plus at least two independent details must uniquely identify one printing. An exact attack name is required unless three other details corroborate it.
2. **Image-assisted recovery:** the closest cached pHash image must pass the distance and separation limits, agree with the OCR name, and match at least two independent details including an exact ability/attack name (or three details without one). The selected catalog record supplies the collector number, set, and official denominator.

These OCR recovery routes pass through the same catalog matcher and label generator. Their reports distinguish `catalog_inferred_from_unique_observed_details` from `image_library_candidate_confirmed_by_ocr` and preserve the original OCR fragment and confidence. Pokeum and pHash fast paths record their identity sources separately and do not claim PaddleOCR confirmation. Ambiguous candidates, high-confidence conflicts, or missing required evidence stop before label generation.

If a run ends at `review_required`, inspect `pipeline-result.json` first, then `field-evidence.json` and the `image_first` or `image_recovery` section for the blocker and nearest candidates. Use a clearer, straightened card-face image if needed. Do not copy a candidate's number into scan keys by hand just to bypass the guard.

The local image cache is a best-effort reference set, not a complete source: the current manifest records 34,242 cached images out of 50,041 localized catalog records (658.31 MB); 15,799 records have no cached image, mostly due to upstream 404s. A missing cached image falls back to OCR and does not trigger a web fetch during scanning.

## Remaining work and rollout plan

1. **Use Pokeum-first with pHash/OCR fallback.** Pokeum is accepted only with a ready encoder index, near-complete catalogue, confident score/margin, and exact local-catalog agreement. `pokeum-result.json` records readiness and every fallback reason.
2. **Build a reviewed evaluation set.** Add clear scans and difficult cases (low resolution, glare, crop/perspective, similar art/reprints, and each supported language). Record exact card IDs and whether OCR, pHash, and the final match were correct. Do not treat one successful scan as threshold calibration.
3. **Measure before tuning.** Track Pokeum acceptance, pHash fallback acceptance, OCR fallback rate, review rate, incorrect candidate rate, and per-language image-cache coverage. Tune distance/gap limits only against a held-out set, prioritizing zero false automatic identities.
4. **Address missing references explicitly.** The current cache has upstream 404s, especially for some languages. Keep those scans in review until a trusted image source or user-provided reference is available; scanning never downloads a substitute image.
5. **Keep fallback measurements separate.** Track Pokeum acceptance, local pHash acceptance, OCR fallback, and review rates independently. Tune acceptance only against reviewed holdout images, prioritizing zero false automatic identities.

Generated labels continue to use the existing mockup mode: condition, serial and QR payload are test data. Finish/print variants remain unverified unless supplied by another trusted source.
