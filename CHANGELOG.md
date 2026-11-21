# Changelog

## 2026-11-22 - Preserve imported card images
- Add pinned image importers and preserve verified external images across catalog refreshes.

## 2026-11-22 - Clear outdated photo readings
- Clear unchanged identification values when the front photo changes, preserving user edits for review.
- Preserve manually edited values during a new reading and reject candidates that conflict with those values.
- Prevent stale searches and cross-language suggestions from attaching an unrelated printing.
- Show and allow review of printed-language catalog candidates, preserving the printed collector number.
- Require verified printed-code evidence before automatically matching a catalog set ID.
- Use reviewed English set names for supported non-English releases.
- Keep promo markers separate from rarity and include server reader tests in CI.
- Record owner-scoped identification diagnostics and schedule deletion of expired records.
- Store identification status and field provenance with new and imported cards.
- Preserve saved card fields when enriching label metadata and avoid relinking unresolved identifications.

## 2026-11-22 - Front photo review notice
- Warn when card details remain after the front photo changes.


## 2026-11-22 - Promo number matching
- Interpret an alphanumeric collector suffix as a promo set code rather than a numeric set count.


## 2026-11-22 - Card identification safeguards
- Avoid silently filling unverified set, year, and rarity values; flag conflicting anniversary readings for review.
- Retry catalog loading after a failure and invalidate the previous photo identity when the front image changes.


## 2026-11-22 - Expand multilingual set reference
- Add sourced set-name and identifier snapshots across 15 languages, additional Japanese references, and the Thai MA6 example.


## 2026-11-22 - Set code research reference
- Add a multilingual set inventory, pinned English abbreviation source, and guidance distinguishing printed marks, catalog IDs, and promo identifiers.

## 2026-11-21 - Preserve card reading values
- Fill available English set and year readings even when the printed-language catalog has no match; mark unmatched readings for review.
- Distinguish an unavailable catalog from a missing record and show the English set reading in the identification dialog.

## 2026-11-21 - Restore application startup
- Reuse the shared language check in card identification to avoid invalid JavaScript syntax that prevented the entire app from loading.
- Add a JavaScript syntax regression test for the card identification page and run application tests before deployment.

## 2026-11-21 - Printed card identity review
- Read printed collector numbers, set codes, symbols, stamps and copyright separately before suggesting a printing.
- Match the original-language catalog by set and collector number, check known denominators and conflicting card details, and keep unverified English counterparts out of the form.
- Show the original collector number and make missing catalog matches and unverified translations clear during intake.

## 2026-11-21 - Localized card matching and automatic rarity
- Fail over across configured Gemini keys on non-quota key, configuration, timeout, network, and upstream errors; keep quota/rate-limit responses terminal.
- Keep the existing single Gemini key as a final fallback when a multi-key pool is configured.
- Read the full visible card with an English Gemini prompt, including attack/ability effects, printed text, regulation mark, and per-field confidence.
- Match the printed-language catalog record and metadata first, map it to English label data, auto-fill only a unique high-confidence identity, and show source-language images for review choices.
- Fill the read-only rarity field from the selected English card record or reviewed uniform set default; keep unknown rarity blank.

## 2026-11-21 - Cloudflare fetch redirect compatibility
- Use Cloudflare Workers-supported manual redirects for Gemini, Oracle OCR, and Oracle media requests; upstream redirects are not followed.
- Cover the supported redirect mode in the card-identification regression test.

## 2026-11-21 - Gemini network failure fallback
- Use the deployed Oracle OCR pipeline when Gemini cannot be reached or returns no usable identity fields.
- Preserve safe fetch failure diagnostics (error name/code and elapsed time) without logging request data or credentials.
- Disclose the Oracle OCR fallback in Add Card and documentation.

## 2026-11-21 - Gemini transient failure recovery
- Retry Gemini once after a network error or upstream 5xx, without retrying quota, configuration, or timeout failures.
- Return a privacy-safe request reference for reading failures and log it with the failure class and upstream status for diagnosis.
- Show the short reference in the Add Card error state so a future production failure can be matched to Cloudflare logs.

## 2026-11-21 - Gemini card identification
- Replaced Oracle OCR and Gemma fallback calls in Add Card with one server-side `gemini-3.5-flash-lite` image-reading request.
- Added structured field parsing, safe quota/configuration errors, confidence-gated catalog auto-fill, and non-automatic English catalog review suggestions when an exact match is unavailable.
- Disclosed Gemini image processing in the Add Card intake flow and kept the API key out of Git and browser code.
- Kept Oracle media storage for saved card photos, removed unused OCR/Gemma Pages adapters and Workers AI binding, and documented the Gemini Pages secret requirement.

## 2026-11-20 - Oracle hostname routing
- Routed the Oracle OCR and media origins through `https://217-142-238-24.sslip.io` with a trusted hostname certificate and deployed the Pages configuration successfully.
- Added deployment validation that skips production publishing when the hostname or other required settings are missing or invalid.
- Added safe Oracle request failure codes and separated OCR availability from Gemma fallback status in the card identification response.
- Updated the Nginx origin template and rollout documentation for hostname TLS; verified the authenticated OCR pipeline against a supplied card scan through the production origin.

## 2026-11-20
- Restore the existing OCR-first Python card-identification pipeline as the Add Card primary path, call Gemma only after OCR cannot uniquely match, and route Gemma fields back through the same local catalog matcher.
- Auto-fill the English catalog record when the Python pipeline returns an exact TCGdex card ID; add a private, loopback-only Oracle OCR adapter with temporary scan cleanup and document its ARM64/PaddleOCR deployment preflight.
- Disable Gemma's default reasoning mode for card OCR, use max_completion_tokens with the prior 2048-token budget, and log finish reason, token usage, refusals, and tool calls when a response has no identity fields.
- Harden the Gemma reader to accept nested and alternate response shapes, preserve numeric identity values, recover JSON from fenced or prose-wrapped responses, and prioritize identity fields with a smaller output budget.
- Keep English catalog candidates for translated cards when their printed collector number differs from the English printing; use strong name evidence and let the user confirm the match.
- Treat a series name as broad context, not an exact set match; rank translated-card candidates by English name, observed year and rarity, and nearby collector numbers so a localized printing does not get replaced by an unrelated same-name card.
## 2026-11-19
- Give card-reading failures a clear explanation and a retry action for temporary service errors.
- Scope rarity choices to the selected set, add source-verified uniform rarity values for McDonald's collections, document the verified no-rarity sets, use the approved year/series map for existing cards, and pair non-English scans with English catalog cards even when catalog IDs differ.
- Route candidate artwork through a same-origin catalog image endpoint, add same-card English artwork fallback, and show saved front photos in My Vault without unrelated sample-card placeholders.
- Add owner-checked front/back image APIs and a private Oracle VM systemd image store; keep Node loopback-only behind the planned TLS proxy.
- Configure the Oracle VM Nginx ACME/HTTPS edge and Let's Encrypt short-lived IP certificate with automatic renewal and reload; allow only TCP 80/443 in the VCN and host firewall.
- Enable one-to-eight-digit Cert input with canonical eight-digit display, per-account availability checks, inline duplicate guidance, and a random available Cert button.
- Add live TCGdex metadata suggestions for name, set, year, and card number, and generate the compact web index from the pinned local catalog snapshot.
- Add explicit Gemma 4 front-image reading, fuzzy catalog candidate ranking, rarity intake, and a required user choice before saving card details.
- Extract the local TCGdex card-image library under `dcr-tag-70x20/catalog/card-image-library/` and keep its downloaded images and SQLite index out of Git.
- Upgrade Vite to 8.3.8, which includes the upstream security fixes, and refresh the lockfile; the Pages workflow already selects Node.js 22 for the supported runtime.
- Render label previews and A4 duplex print sheets from the approved 70 × 20 mm SVG masters, with live field updates and generated DCR test QR/Code 128 codes.
- Align the A4 sheet guide with the approved 10 × 4 portrait layout and long-edge duplex instructions.
- Replace demo credentials with Google Identity Services and automatic self-registration, server-verified sessions, and owner-scoped D1 card APIs.
- Redesign sign-in as a responsive DCR split layout and remove the global site navigation from the login screen.
- Add an explicit legacy-data import choice; retain the browser copy and omit card images.
- Add the initial D1 migration and gate automatic Pages publishing until Google OAuth and D1 deployment settings are present.
- Document account data, privacy boundaries, and Cloudflare/Google setup.
- Clarify that External/Testing sign-in can allow all Google accounts with only basic identity scopes; verified Published branding still requires domain ownership.
- Fix Pages deployment to use the root Wrangler configuration without the unsupported custom config path option.
- Fix the logout Function to import the session cookie helper from the sessions module.
- Set the Pages compatibility date to the latest date accepted by Cloudflare's UTC deployment runtime.
## 2026-11-19
- Add a GitHub Actions workflow to build and deploy the site to the existing Cloudflare Pages project.
- Document the production deployment flow and required GitHub repository secrets.
- Document the Cloudflare Pages deployment token rotation date.
