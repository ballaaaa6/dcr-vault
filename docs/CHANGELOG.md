## Work completion rule - 2026-11-22
- Require the full authorized code change and final diff review before commit and push; leave incomplete work local unless a partial publication is requested.

## Gemini direct form values - 2026-11-22
- Request English intake values per field from Gemini and fill the card form before catalog lookup completes. Show missing fields and per-field catalog disagreements; catalog matching supplies identity and label metadata only when values agree.

# Changelog

## 2026-11-22 - Front photo review notice
- Warn when card details remain after the front photo changes.


## 2026-11-22 - Promo number matching
- Interpret an alphanumeric collector suffix as a promo set code rather than a numeric set count.


## 2026-11-22 - Card identification safeguards
- Avoid silently filling unverified set, year, and rarity values; flag conflicting anniversary readings for review.
- Retry catalog loading after a failure and invalidate the previous photo identity when the front image changes.


## 2026-11-22 - Expand multilingual set reference
- Add sourced set-name and identifier snapshots across 15 languages, additional Japanese references, and the Thai MA6 example.


## Set code research reference - 2026-11-22
- Document the available multilingual set inventory, source coverage, ambiguity, and remaining printed-code verification.


## Card reading fallback - 2026-11-21
- Preserve Gemini's available English set and year when no printed-language catalog record is found, while marking those values unverified.
- Report catalog loading failures separately from missing records.
## Shared rarity values - 2026-11-21
- Normalize rarity at intake and use the same value on the label, including Promo, RR, AR, and SAR.
- Resolve unique catalog cards despite a conflicting year and flag the discrepancy.
- Require English instructions in Gemini prompts.

## Promo rarity fallback - 2026-11-21
- Fill rarity as `Promo` when the explicit promo set name, label, or collector/set code identifies the card as a promo and Gemini leaves rarity blank.
- Ask Gemini to report explicit promo markings as rarity even when the card has no separate rarity symbol.

## Gemini API key failover - 2026-11-21
- Accept a server-side newline-separated `GEMINI_API_KEYS` secret while retaining the legacy single-key setting.
- Move to another key only after Gemini explicitly rejects the current key; never rotate keys on quota/rate-limit responses.
- Retry transient network and upstream failures once with the same key, and cover invalid-key failover and quota handling in backend tests.

## Direct Gemini card identification - 2026-11-21
- Ask Gemini to identify one card directly from its visible name, artwork, attacks, HP, set code, collector number, and print marks, and return evidence plus fields that need review.
- Return Gemini's structured reading without requiring OCR or catalog matching to pass; fill the English intake form from that answer and link an exact catalog record only when one is available.
- Allow rarity to be corrected in the intake form and preserve manual review when Gemini cannot supply English label values.
- Preserve the scanned card's language when linking an English catalog record, and never treat that English set ID as an approved localized label profile.
- Remove the former source-print ranking and candidate-picker path; catalog data is now used only for optional exact English record and label metadata lookup.

## Evidence-based image identification - 2026-11-21
- Preserve localized attack and ability effects plus card print variants in the web catalog index.
- Read and display collector number, Pokédex number, level, attack effects, and foil finish separately with field confidence.
- Invoke OCR fallback when Gemini has neither a confident full collector number nor two identity anchors; stop candidate matching when both readers confidently disagree on critical fields.
- Compare compatible bilingual attack readings semantically and only stop on critical disagreements when both readers are confident.
- Reject source and English catalog candidates that conflict with confident HP, illustrator, type, attack, ability, or finish evidence; rank by source-print evidence.
- Keep unverified cross-language candidates out of the review picker instead of filling it with same-name cards.
- Treat printed language-qualified set codes such as `SVPEN` as aliases for their catalog set IDs.
- Persist the selected source card ID and observed finish alongside the English catalog printing.

## Localized card matching and automatic rarity - 2026-11-21
- Expand the English Gemini prompt and structured output to capture all visible identity/card details, attack and ability effects, printed text, regulation mark, and field confidence.
- Match the source-language print against catalog metadata before mapping to English label data; display the original-language card image and skip the picker only for a unique, high-confidence match.
- Fill label name, set, year, number, and rarity from the English catalog card; make rarity read-only and automatically populated.

## Cloudflare fetch redirect compatibility - 2026-11-21
- Use the redirect mode supported by Cloudflare Workers for Gemini, Oracle OCR, and Oracle media fetches, preventing identify requests from failing before reaching upstream services.
- Keep upstream redirects manual so service credentials are not forwarded to another origin.

## Gemini network failure fallback - 2026-11-21
- Fall back to the deployed Oracle OCR pipeline when Gemini fails or returns no identity fields.
- Log safe network exception metadata and preserve request references without logging images, OCR text, or credentials.
- Disclose both image processing paths in the Add Card intake and deployment documentation.

## Gemini transient failure recovery - 2026-11-21
- Retry Gemini once after network errors or upstream 5xx responses; quota, configuration, and timeout failures are not retried.
- Add privacy-safe request references to server diagnostics and the Add Card error state.

## Gemini card identification - 2026-11-21
- Replaced the Oracle OCR-first / Gemma-fallback identification route with a single server-side Gemini `gemini-3.5-flash-lite` request.
- Added structured JSON extraction, confidence-gated unique catalog matching, and ranked review candidates that never auto-select.
- Disclosed Gemini image processing in the Add Card intake flow.
- Kept Oracle image storage for saved photos and documented the Pages `GEMINI_API_KEY` secret and Gemini privacy boundary.

## ARM64 OCR recovery - 2026-11-20
- Added a Tesseract OCR fallback for the Oracle ARM64 service when Paddle native inference fails, while preserving the existing card-key parser and catalog lookup flow.
- Added script detection and Thai name/stage parsing, including a title-band OCR pass for split Thai glyphs.
- Accepted one clean catalog record when the OCR name and complete collector number (including denominator) match confidently.
- Made the service health response report Tesseract fallback availability and exposed privacy-safe Oracle OCR failure reasons to the Add Card picker.

## OCR-first production rollout - 2026-11-20
- Installed and enabled the OCR service on the Ubuntu ARM64 Oracle VM with the pinned PaddleOCR runtime and the private 42,599-card catalog.
- Added the HTTPS OCR proxy while preserving the existing media-store route and stored the shared token in Oracle's protected environment file and the Cloudflare Pages production secret.
- Verified the OCR health endpoint reports its catalog ready and rejects unauthenticated requests.

## Metadata-first card identification - 2026-11-20
- Expanded the compact catalog index with the printed-card metadata used by the documented identification workflow, including HP, illustrator, stage, types, attacks, weaknesses, and set card counts.
- Replaced fuzzy name-first English suggestions with exact source-language card lookup followed by metadata corroboration against English catalog records.
- Auto-filled only a unique high-confidence match, kept ambiguous credible matches in the picker, and preserved the printed source collector number.
- Added exact source-card art thumbnails, hover previews, match evidence, and a same-card CDN fallback when the image proxy cannot load the thumbnail.
- Expanded card reading to capture metadata used to confirm a match.

## Card identification reliability - 2026-11-20
- Kept printed card fields as the required AI response and made English equivalents optional to reduce response-format pressure while preserving English catalog matching.
- Separated image-reading failures from catalog-loading failures in the match dialog.
- Added privacy-safe Worker diagnostics for empty or unparseable AI responses; logs include response shape and recognized field names, never card text or image data.

## English card intake and match picker - 2026-11-19
- Moved image-reading matches into a centered modal with compact card previews and larger hover previews.
- Resolved localized image matches to English catalog names and sets, and made rarity and grade selectable dropdowns.
- Added English-equivalent reading fields for catalog matching while keeping selected and displayed names in English.
- Prevented non-Latin card names or set names from being saved or printed on labels.
- Aligned Add Card form fields and documented the English label-text flow.

## Multi-user sign-in and private storage - 2026-11-19
- Added Google self-registration, server-verified sessions, owner-scoped D1 storage, and a responsive DCR login screen.
- Added an explicit selected-card import from legacy browser storage without uploading photos or removing the local copy.
- Updated production deployment to apply D1 migrations and wait for required Google and Cloudflare configuration.

## Card vault UX refresh - 2026-11-19
- Reworked the shared navigation and responsive menu around the DCR Card Vault identity.
- Replaced the Home featured-card and promotion sections with a focused certificate search and DCR card illustration.
- Updated certificate lookup result states, clarified local record behavior, styled the core app pages, and made Vault filters work.

## Logo and typography refresh - 2026-11-18
- Added a transparent SVG DCR mark extracted from the approved label artwork and switched the site logo placements to it.
- Self-hosted Inter and Noto Sans Thai variable fonts and standardized shared interface typography while keeping the printed label master unchanged.

## Asset loading fix - 2026-11-18
- Corrected DCR logo and shield URLs to use Vite's public asset paths so they load on Cloudflare Pages.

## Workspace organization - 2026-11-18
- Moved the DCR Card Vault app to the workspace root and grouped its documentation under docs/.
- Added the DCR label toolkit under dcr-tag-70x20/, retained its source bundle under archive/source-packages/, and added workspace file-placement rules.
- Documented that the earlier static app kept data per browser and that its temporary demo login was not production access control.
- Added the project rule to commit and push future project changes to GitHub origin.

## 1.0.0 - 2026-11-18
- Initial zip: Home, Search, Vault, Label, temporary demo Login, Verify, Red-White theme, real DCR logo, 3D hover effects, print A4 40-up.
