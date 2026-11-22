# Changelog

## 2026-11-22 - Certificate label codes
- Link each label QR to its public certificate and keep both barcodes tied to the saved Cert number.

## 2026-11-22 - Remove old intake route
- Remove the unused /search redirect now that card intake uses /register.

## 2026-11-22 - Register page
- Rename the Add Card URL to /register, preserve old links, and reduce desktop vertical spacing.

## 2026-11-22 - Condition grade guidance
- Show PSA grade equivalents in the Add Card condition selector while retaining the existing saved condition.

## 2026-11-22 - Add Card section headings
- Remove the numbered badges from the card image and details sections.

## 2026-11-22 - Card photo uploads
- Refresh the front and back photo dropzones with larger previews and an on-image remove control.

## 2026-11-22 - Card details form layout
- Give the card name a full row and place the certificate number beside condition with consistent row spacing.

## 2026-11-22 - Add Card page layout
- Reduce vertical spacing and keep the footer at the bottom when the form fits on screen.

## 2026-11-22 - Home shortcuts
- Link home feature cards to Add Card, My Vault, and Labels with new icons, and align the slimmer search bar with the cards.

## 2026-11-22 - Home search and feature cards
- Compact the certificate search, clarify its instructions, and frame the three home features.

## 2026-11-22 - Home page layout
- Update the home page with feature icons and a full-height layout that places the footer at the bottom.

## 2026-11-22 - Certificate search placeholder
- Match the certificate search placeholder text and typography to the reference.

## 2026-11-22 - Responsive home headline
- Scale the home headline to its available width so each phrase fits on its own line.

## 2026-11-22 - Home page messaging
- Refresh the home page headline and description, and remove the redundant brand label.

## 2026-11-22 - Red navigation bar
- Use a red navigation bar with white text and a larger DCR brand.

## 2026-11-22 - Global Source Serif 4 font
- Use the self-hosted Source Serif 4 font throughout the app and privacy policy.

## 2026-11-22 - Global Playfair Display font
- Use the self-hosted Playfair Display font throughout the app and privacy policy.

## 2026-11-22 - Larger website text
- Increase text sizes throughout the app and privacy policy for better readability.

## 2026-11-22 - Global Instrument Serif font
- Use the self-hosted Instrument Serif font throughout the app and privacy policy.

## 2026-11-22 - Certificate viewer image size
- Enlarge the viewer image and reduce the footer text size to make better use of the screen.

## 2026-11-22 - Certificate viewer image size
- Enlarge the viewer image and reduce the footer text size to make better use of the screen.

## 2026-11-22 - Production site address
- Deploy the site to dcrcards.pages.dev and retain the existing project for image authorization and older links.

## 2026-11-22 - Certificate viewer copyright text
- Complete the DCR attribution and copyright text below certificate images.

## 2026-11-22 - Certificate viewer home link
- Replace the viewer instruction with a linked DCR Card Vault attribution.

## 2026-11-22 - Stable certificate viewer layout
- Keep the viewer controls, thumbnails, and text in place when switching between images of different sizes.

## 2026-11-22 - Larger certificate images
- Scale certificate viewer images to use the available screen height while preserving their proportions.

## 2026-11-22 - Certificate download filenames
- Name downloaded images using the certificate number and selected side.

## 2026-11-22 - Certificate image download
- Add a download button for the selected image in the certificate viewer.

## 2026-11-22 - Certificate brand and year order
- Place Brand/Title before Year in certificate information.

## 2026-11-22 - Certificate field order
- Place Card Name before Set Name in certificate information.

## 2026-11-22 - Certificate information formatting
- Place Language last and use title case for item labels while keeping values uppercase.

## 2026-11-22 - Uppercase certificate information
- Display all item information in uppercase on certificate records.

## 2026-11-22 - Certificate information
- Show the saved condition, full language name, and Brand/Title on certificate records while preserving printed collector numbers.

## 2026-11-22 - Login page redesign
- Refresh the login page with the Discovery artwork, gentle motion, and clearer sign-in copy.

## 2026-11-22 - Illustrated login concepts
- Add five animated login previews with newly generated collector-themed imagery.

## 2026-11-22 - Login design concepts
- Add five standalone login design previews for review, with the existing Google sign-in represented as a mockup.

## 2026-11-22 - Certificate URLs
- Use /cert/<number> links for certificate searches while keeping existing verify links working.

## 2026-11-22 - Clean page URLs
- Use clean paths throughout the app and preserve existing hash links.

## 2026-11-22 - Certificate page cleanup
- Remove the redundant record found badge from certificate details.

## 2026-11-22 - Certificate detail page
- Show a searchable certificate record with card information, uploaded photos or a labeled catalog reference, and an enlarged image viewer.

## 2026-11-22 - Vault reference images
- Show matched catalog reference images in My Vault, falling back to the saved front photo when a reference is unavailable.
- Publish the local image index's public source URLs; image files remain in the local library and the source hosts serve them on demand.

## 2026-11-22 - On-demand card reading details
- Keep identification results available from the Card details information button without opening a dialog automatically.
- Disable and gray out identification while reading and show errors inline.

## 2026-11-22 - Prevent conflicting candidate selection
- Reject catalog candidates that conflict with the printed reading instead of combining their identities.
- Keep card saving independent of label layout and retain a failed save outcome when a retry succeeds.

## 2026-11-22 - Card evidence enrichment
- Add sourced Thai Charizard HP and illustrator and Japanese promo release year for review.

## 2026-11-22 - Metadata evidence validation
- Validate field evidence records and report catalog coverage per set in addition to language.

## 2026-11-22 - Card metadata audit and workflow
- Add a reproducible catalog coverage audit, field-level evidence examples, and an identification-to-form guide.

## 2026-11-22 - Preserve imported card images
- Add pinned image importers and preserve verified external images across catalog refreshes.

## 2026-11-22 - Clear outdated photo readings
- Clear unchanged identification values when the front photo changes, preserving user edits for review.
- Preserve manually edited values during a new reading and reject candidates that conflict with those values.
- Keep unresolved photo identities from being silently reattached through typed-card lookup.
- Prevent stale searches and cross-language suggestions from attaching an unrelated printing.
- Show and allow review of printed-language catalog candidates, preserving the printed collector number.
- Require verified printed-code evidence before automatically matching a catalog set ID.
- Use reviewed English set names for supported non-English releases.
- Offer number-and-language candidates for review when a printed name is missing or differs.
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
# Set inventory reconciliation - 2026-11-22

- Refresh multilingual set inventories, add official Thai product search entries, and retain potentially conflicting IDs for review instead of merging them automatically.
- Add a second independent language-by-language set-list snapshot for comparison; preserve unlinked entries and source-specific identifiers.
- Add official Japanese, Korean, and additional Southeast and East Asian regional product search filters, retaining their separate scopes.
- Add a source-qualified set name and code index with separate deck-list abbreviations and verified printed-code evidence.
- Capture an additional English set-code source with its reported on-card status, preserving shared codes and unconfirmed entries.
- Index official set-mark images and sample card URLs from archived Japanese, Korean, and Traditional Chinese records and the live Thai product filters.
