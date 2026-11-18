# Card Layout Survey and Parser Data Plan

Survey date: 2026-10-20
Scope: existing local catalog, sample manifest, and generated contact sheets. This was not a card-by-card review of all 50,041 catalog records.

## Summary

Reviewed 19 contact-sheet pages covering 348 available images from 576 selected examples: 11 English, 2 Japanese, 2 Thai, and 4 Traditional Chinese. The core sample covers all 479 localized set entries in the catalog; 97 additional examples cover Trainer, Energy, and special Pokémon cards.

| Language | Catalog sets | Sets with at least one image | Selected examples | Available images |
| --- | ---: | ---: | ---: | ---: |
| English (en) | 216 | 163 | 264 | 204 |
| Japanese (ja) | 128 | 33 | 154 | 35 |
| Korean (ko) | 11 | 0 | 16 | 0 |
| Thai (th) | 32 | 27 | 38 | 29 |
| Simplified Chinese (zh-cn) | 8 | 0 | 14 | 0 |
| Traditional Chinese (zh-tw) | 84 | 75 | 90 | 80 |
| **Total** | **479** | **298** | **576** | **348** |

The catalog index contains 50,041 card records across six languages. The sample is missing 228 images. Available Japanese images are concentrated in newer eras. The selected Korean and Simplified Chinese samples have no images. Older English cards and some promotional sets also lack references.

The selected examples are imbalanced: 505 Pokémon, 38 Trainer cards, and 33 Energy cards. This is an exploratory sample, not a balanced training set. The current 41 layout suggestions group records by metadata; they are not confirmed visual families.

“Image missing” means the API did not return an image for the selected card and a limited fallback from the same set/category was not available. It does not prove that every card in that collection lacks an image.

The generated `layout-training-index.json` stores image paths, SHA-256 checksums, observed card IDs (including same-set fallback cases), and catalog truth such as card name, HP, attacks, damage, and effects. It is **not a fully annotated training set**: every image still needs a reviewed layout family, bounding boxes, and text roles.

## Observations from the sample images

1. **Major zones recur, but their boundaries change by era.** Headers, name/HP, artwork, ability or attack text, weakness/resistance/retreat, and footer are useful anchors. Base/Gym/e-Card, EX, Diamond & Pearl/HGSS, Black & White, XY, Sun & Moon, Sword & Shield, Scarlet & Violet, Mega Evolution, and Pokémon TCG Pocket should not be forced into one template.
2. **Catalog series are not visual layout families.** A series can contain regular, EX/GX/V/ex, full-art, and promo variants; multiple series may share a regular frame. Group by actual frame geometry and use series as metadata, not as the primary rule.
3. **Separate card categories before parsing text.** Pokémon, Trainer, and Energy layouts differ. Trainer cards further divide into Item, Supporter, Stadium, and Tool. One or two Trainer/Energy examples per series are not enough to characterize every layout.
4. **Special cards are layout variants, not just rarities.** EX/GX/V/VMAX/VSTAR/ex, TAG TEAM, V-UNION, and full-art cards can change artwork size, rules/attack area, and information frame.
5. **Similar geometry does not imply identical text roles.** Attack regions can contain names, damage, and multi-line effects. A continuation line can sit beside the attack name at a similar vertical position; flavor text is lower, but does not begin at the same coordinate on every card.
6. **Language affects line shape.** Newer Japanese, Thai, and Traditional Chinese examples share some overall structure, but glyph widths, line counts, and wrapping vary. OCR and line grouping need language-specific calibration even when some geometry families are shared.
7. **Artwork is an unreliable layout signal.** Reprints can share artwork across sets. Use the frame and surrounding text, not Pokémon identity or color, to classify a layout.

## What the Wurmple case exposed

Wurmple xy6-3 from Roaring Skies was read correctly for name, number 3/108, and HP 60. The parser incorrectly treated “Bench. Shuffle your deck afterward.” — the continuation of Flock's effect — as another attack name. It is in the attack area at y≈0.671, so the previous attack_y_max=0.80 boundary could not filter it out. Flavor text begins around y≈0.847 and could be filtered.

The en:xy profile had been based only on Vespiquen xy7-10, but it was applied to Wurmple because both cards share series_id=xy. That evidence was too broad, so the profile was changed to reference_only. The previous behavior now safely returns review_required.

The Wurmple image is stored with a challenge case and draft annotation at [failure-cases/wurmple-xy6-3-20261020.json](failure-cases/wurmple-xy6-3-20261020.json). It is now a parser regression case and must not be counted as unseen holdout data after its use in rule changes. Its annotation still needs human review before it can be used for training.

## Known gaps

- **Image coverage:** 181 of 479 localized set entries have no image. Available Japanese, Thai, and Chinese images skew toward newer sets.
- **Card-category coverage:** Core examples emphasize regular Pokémon. Trainer, Energy, and special cards are sparse and selected by series rather than by visual variant.
- **Annotations:** The catalog contains expected text but not its location in the image. Reviewed boxes are missing for name, HP, attack name/effect, ability, flavor text, or footer.
- **Line classification:** OCR recognition confidence is separate from role confidence, but the heuristic can still assign high role confidence to a short effect continuation.
- **Profiles:** A language:series_id profile is too broad for pilot use. A profile must identify a visual family, language, and card category/variant, supported by examples.
- **Evaluation:** There is no set-separated holdout with role precision/recall and false automatic acceptance metrics.

## Detailed work plan

### Phase 1 — Freeze provenance and close the coverage inventory (partially complete)

1. Preserve the manifest, local catalog identity, image URL, observed card ID, and file checksum in the index.
2. Reconcile all 479 language/set entries into image_available, image_missing, fallback_image, and source_unresolved states.
3. Add images only from the same language and printing. Do not borrow another language or printing to make coverage appear complete.
4. Record every failure and its cause for later provider evaluation.

**Exit criteria:** Every sample has clear provenance and a known card identity. Missing images remain explicitly marked missing.

### Phase 2 — Build a visual layout taxonomy

1. Inspect full-resolution samples and assign visual_family_id from actual frame and zone geometry, not from series names.
2. Track independent labels for language/script, card_category, frame_family, card_variant, and special_rule_frame.
3. Use examples from multiple sets for each family. Split families or add exceptions when geometry differs across expansions.
4. Record normalized anchors for name/HP, artwork window, text box, attack rows, weakness/retreat, and footer.

**Exit criteria:** Every family proposed for runtime use has examples from at least two sets and documented exceptions. A profile supported by one card remains draft.

### Phase 3 — Create reviewed training annotations

1. Run OCR in batches, loading the model once. Keep raw text, polygon/bounding box, recognition confidence, and model version.
2. Use catalog truth to propose text-to-field matches, but treat them as drafts until a reviewer verifies them.
3. Have a person review key examples and label roles separately: attack_name, attack_cost, attack_damage, attack_effect, ability_name/effect, flavor_text, trainer_rule_text, metadata, and footer.
4. Use normalized bounding boxes [x0,y0,x1,y1] against the source image. Allow unknown, overlap, cropped, and needs_review states.
5. Store OCR text confidence separately from role confidence and annotation reviewer/status.

**Examples per family:** regular Pokémon with one and two attacks; long or multi-line effects; attacks without damage; Ability and flavor-text cases; Trainer Item/Supporter/Stadium/Tool; Basic and Special Energy; and at least one special frame when available.

**Exit criteria:** Training examples have provenance, reviewed text, and reviewed roles/boxes. Catalog truth without box annotations does not count as supervised training data.

### Phase 4 — Improve the parser with geometry and context

1. Select visual family from image geometry before applying set metadata; use series_id only as a prior.
2. Classify attack rows using energy cost, attack name, right-aligned damage, and shared baseline together.
3. Classify continuation effects from vertical position, indentation, sentence structure, and previous-row context. Never rely only on “short text inside attack band = attack name.”
4. Use catalog candidates to corroborate attack names, but do not discard unmatched text without geometry/role evidence.
5. Preserve the safety gate: if exact name/number and role checks do not pass, return review_required and do not create a label.

### Phase 5 — Evaluate without data leakage

1. Split train/validation/holdout by set or visual family, not by randomly assigning cards from the same set.
2. Measure exact field match, attack-name versus effect precision/recall, candidate accuracy, review rate, and false auto-acceptance separately by language, era, and card category.
3. Keep Vespiquen as a successful recovery case and Wurmple as an effect-continuation regression. If Wurmple changes the rules, move it out of holdout and find a new holdout.
4. Set release targets before enabling auto-labeling: no false auto-accept on holdout, exact name and number, and at least 99% role precision for label-critical fields. Insufficient evidence must go to review.

### Phase 6 — Enable profiles gradually

1. Progress profiles from draft to pilot to calibrated only after multi-set examples, reviewed annotations, and passing holdout results.
2. Runtime reads only calibrated local profiles and makes no network calls during scanning.
3. Record profile ID, evidence, OCR boxes, and fallback reasons in each scan report.
4. Turn every new failure into a challenge case with raw OCR and a draft annotation for regression/evaluation.

## Existing artifacts

- `layout-training-index.json`: 576 samples, 348 available images, 0 unresolved catalog identities; layout annotation has not started.
- `parser-sample-set.json`: 18 English/Japanese/Thai/Traditional Chinese images covering XY regular/EX, Trainer, Energy, and BW/e-Card/SWSH/SV eras. Line roles are not reviewed except for the Wurmple draft; Korean and Simplified Chinese images are absent.
- [Wurmple regression case](failure-cases/wurmple-xy6-3-20261020.json) and its source image.
- `layout-profile-suggestions.json`: metadata-based grouping, not approved visual families.
- `manifest.json`: provenance and original sample coverage.

## First parser correction

- When one candidate has exact name and number, only attack fields conflict, at least two independent fields corroborate the identity, and OCR contains every catalog attack name exactly once, the parser reclassifies the existing raw OCR lines. It does not rerun OCR.
- Lines not classified as attack names are excluded from the attack list and retained in field evidence with a reason.
- If an attack name is missing or repeated, the candidate is not unique, or identity evidence is incomplete, the result remains review_required.
- Replaying the saved OCR for Wurmple and Vespiquen passed exact candidate checks, restored the attack list, passed validation, and generated mockup labels without rerunning OCR. The replay took about 3.0 seconds per card.
- The Wurmple result is retained as a regression. Shuckle xy10-1 remains a candidate holdout and has not been used to tune the correction.
- Passing two regressions does not enable general automatic profiles. Reviewed annotations and evaluation on other held-out sets are still required.
