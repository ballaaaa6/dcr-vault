# Card label workflow

Use this workflow whenever the user asks to create a DCR label from an uploaded or local Pokémon card image.

## Choose the right action

- Run `pipeline/image_to_label.py` with its default image-first strategy. It calls the local Pokeum API first. Accept Pokeum only when the service has a ready index for its configured encoder (DINOv2 ONNX when installed, otherwise `histogram-v1`) and near-complete catalogue coverage, its result is `confident` with confidence at least 0.80 and margin at least 0.10, and the exact card name, set, full collector number, language, and card ID resolve in the local catalogue.
- If Pokeum is disabled, unavailable, incomplete, uncertain, or conflicts with the local catalogue, continue to the local image index. Accept its selected record only when the best pHash distance is within 8 bits and the runner-up gap is at least 4; otherwise use OCR and the existing text-first recovery route.
- Use `--strategy ocr-first` to compare with the former OCR-first workflow. Use `--disable-image-recovery` to force OCR-first behavior.
- Use `--disable-pokeum` to bypass Pokeum while preserving the local pHash and OCR steps.
- Set `--language` to the printed language when it is clearly not English (supported codes: `en`, `th`, `ko`, `zh-tw`, `zh-cn`, `ja`). If language is unclear, do not silently use English.
- If the user asks only to identify or inspect the card, add `--lookup-only` so no mockup is created.
- If the user only attaches an image without a clear task, ask whether they want identification or a label.

## Handle the result

- On `label_created`, show the generated front and back PNGs and link the output's `card-record.md`, `label-input.json`, and match report. State that condition and serial are mockup data and finish remains unverified unless there is reliable evidence.
- Pokeum-first runs save `pokeum-result.json` and record the selected catalog row and Pokeum confidence/margin. Pokeum OCR contributes to its own ranking but does not count as the full-card PaddleOCR result. OCR is skipped only when a Pokeum or pHash identity passes its acceptance gates; do not describe either identity as PaddleOCR-confirmed.
- Local pHash runs record `identity_source: local_image_library_pHash`, ranked candidates, distance, runner-up gap, and selected catalog record.
- If Pokeum and local pHash both fail their gates, the pipeline runs OCR. On `review_required`, `ambiguous`, `conflict`, or `no_match`, inspect `pipeline-result.json`, `field-evidence.json`, and image-match details; report the nearest candidates and exact blocker.
- Do not copy a candidate's number into scan keys by hand or bypass the configured distance/gap gates.
- Pokeum receives scans through the loopback API only. Catalogue/model downloads happen during explicit Pokeum setup, not per scan. Keep each run's evidence; `raw-ocr.json` is absent when PaddleOCR was skipped.
