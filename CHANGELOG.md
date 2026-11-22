# Changelog

## 2026-11-22 - Flip profile edit icon

- Flip the pencil icon beside the profile name horizontally.

## 2026-11-22 - Resize profile calendar

- Keep the collecting date calendar compact while retaining the existing date field width.

## 2026-11-22 - Add collector profile details and shared footer alignment

- Add collecting start date and collection goal to personal details.
- Use the shared footer alignment for standard pages, including profile.

## 2026-11-22 - Personalize collector profiles

- Move display name editing beside the profile name and add editable favorite series and short bio fields.
- Add a database migration for persistent personal details.

## 2026-11-22 - Streamline profile photo selection
- Open the file picker directly, then allow dragging the selected photo within the circular crop guide.

Times are commit times in Bangkok time (UTC+7); older entries without a time have no matching commit record.

## 2026-11-22 - Preserve full profile photos
- Keep the entire uploaded photo and its proportions in the profile preview.

## 2026-11-22 - Fit profile photo preview to image
- Size the profile photo dialog to its image while keeping it within the screen.

## 2026-11-22 - Enlarge profile photo preview
- Show the profile photo centered in a nearly full-screen preview.

## 2026-11-22 - Make personal details read-only by default
- Show the display name as text until the profile edit button is selected.

## 2026-11-22 - Refine account profile
- Limit edited display names to 12 characters and open profile photos in a preview dialog.

## 2026-11-22 - Add account profile
- Add an account menu and private profile editing for display name and photo, preserving edits on Google sign-in.

## 2026-11-22 - Adjust vault price display
- Show the purchase amount before its currency in private vault details.

## 2026-11-22 - Refine vault date picker
- Replace native month and year menus with a white calendar and selectable year and month grids.

## 2026-11-22 - Refine label vault selection
- Use aligned heart selection controls and shade cards already added to the label sheets.

## 2026-11-22 - Improve label card selection
- Show front card photos in label rows and the vault picker, add a red remove icon, and support select all with selected-row shading.

## 2026-11-22 16:33 - Record changelog times and archive research
- Add available commit times to changelog entries and retain catalog research and source packages.

## 2026-11-22 16:30 - Improve vault acquisition date
- Rename Source to Acquisition and improve the date picker with month and year selection, a white theme, adaptive placement, and disabled future dates.

## 2026-11-22 16:23 - Default vault sorting
- Show cards by newest received date by default in My Vault.

## 2026-11-22 16:21 - Clarify completed card details
- Show an English language hint, shade filled intake fields, and focus the first invalid required field when adding a card.

## 2026-11-22 16:16 - Clarify anniversary set names
- Display and save the 25th and 30th Celebration set names consistently while retaining catalog set identities.

## 2026-11-22 16:11 - Reconcile Gemini readings with catalog
- Show Gemini readings first and apply differing catalog values for matched cards while preserving user edits and printed numbers.

## 2026-11-22 16:01 - Fade intake status messages
- Keep the intake status visible for six seconds, then fade it over four seconds; restart the timer for each message.

## 2026-11-22 15:58 - Standardize card label fields
- Derive card type and language labels from the identified game and language, and recognize equivalent promo set names.

## 2026-11-22 15:49 - Verify uncertain card readings
- Leave uncertain Gemini fields blank until corroborated by the catalog, add a verified Rayquaza-EX promo, and revalidate the catalog on reload.

## 2026-11-22 15:35 - Recover missing card details
- Fill the illustrator from Gemini and use corroborated catalog evidence to suggest missing intake details while preserving printed numbers and user edits.

## 2026-11-22 15:26 - Keep card intake stable after reading
- Show intake status messages without moving the card form or image fields.

## 2026-11-22 15:24 - Fit the add-card page
- Reduce image upload and form height on desktop to fit the intake page more comfortably within the screen.

## 2026-11-22 15:21 - Simplify card intake
- Remove the Notes field from the add-card form.

## 2026-11-22 15:19 - Clearer label text spacing
- Reserve a 2 mm gap between left and right label text, abbreviating long lines as needed.

## 2026-11-22 15:18 - Dismiss vault card options
- Close the vault card options menu when clicking elsewhere on the page.

## 2026-11-22 15:16 - Fit long label text
- Abbreviate words from the end of an overlong label line until it fits, while retaining the original card details.

## 2026-11-22 15:14 - Quick card deletion
- Move card deletion to the vault card options menu and keep the confirmation dialog.

## 2026-11-22 15:11 - Review label details from card readings
- Ask Gemini for card type, language label and series, allow review and editing, and save the fields for label printing.

## 2026-11-22 15:02 - Label card type and series
- Show card type and series in label details and print year, type, language and series using approved fit abbreviations.

## 2026-11-22 14:50 - Card year on labels
- Print the recorded card year and remove the separate year / series display and profile requirement.

## 2026-11-22 14:47 - Promotional card rarity
- Fill Promo for promotional card readings and record intake-form values in identification diagnostics.

## 2026-11-22 14:43 - Read-only label details
- Show the card year separately from the verified label year / series and make label details read-only.

## 2026-11-22 14:39 - Compact label workspace
- Arrange certificate entry and the sheet list in side-by-side columns on larger screens, with unobtrusive scrolling.

## 2026-11-22 14:36 - Label sheet workspace
- Add certificate range lookup and multi-select vault cards to a single-page label workspace, with optional previews and multi-sheet PDF download.

## 2026-11-22 14:25 - More prominent navigation logo
- Enlarge the DCR logo beside the full registry name.

## 2026-11-22 14:22 - Full registry name
- Show Distinguished Card Registry beside the navigation logo.

## 2026-11-22 14:19 - Clear search visibility
- Show search clear buttons only when their fields contain text.

## 2026-11-22 14:17 - Clear search
- Add clear buttons to vault and certificate searches, restoring vault cards and clearing certificate results immediately.

## 2026-11-22 14:12 - Vault test fixture
- Support date picker initialization in the vault selection test.

## 2026-11-22 14:10 - Vault sort filter width
- Left-align sort labels and size the filter to its longest option.

## 2026-11-22 14:09 - Received date calendar
- Add an English date picker matching the Flowbite-style calendar and the field width.

## 2026-11-22 14:05 - Vault sort text
- Fit and center the sort filter labels.

## 2026-11-22 14:01 - Private vault details and sorting
- Add purchase currency, source, seller and received date; preserve previous private details.
- Sort vault cards by name, purchase price grouped by currency, or received date.

## 2026-11-22 13:46 - Certificate search input
- Pad numeric vault certificate searches to eight digits and restrict home certificate input to numbers.

## 2026-11-22 13:23 - Vault empty search results
- Show the no-results message across the full vault layout and hide stale card details.

## 2026-11-22 13:19 - Vault search bar
- Place the status filter before a home-style search bar with a Search button.

## 2026-11-22 13:14 - Edit certificate numbers
- Allow vault owners to change a card's Cert number, with validation and global duplicate protection.

## 2026-11-22 13:03 - Vault detail views
- Switch between card and private details and edit each separately.

## 2026-11-22 12:56 - Vault photo hover controls
- Hide photo controls when the pointer leaves while preserving keyboard access.

## 2026-11-22 12:52 - Vault photo fit
- Fill the padded photo panel and keep the entire card image visible.

## 2026-11-22 12:52 - Vault photo panel sizing
- Keep the photo panel tied to the selected card details height, including shorter records.

## 2026-11-22 12:50 - Vault photo controls
- Reveal photo controls on hover and match the photo panel height to the details panel.

## 2026-11-22 12:47 - Vault card photo viewer
- Flip between card sides in the vault and preview, with certificate-style magnification.

## 2026-11-22 12:42 - Compact vault details
- Remove the redundant print link and reduce spacing between item information rows.

## 2026-11-22 12:39 - Vault page height
- Align the vault footer with Home and Add Card and scroll only when content exceeds the viewport.

## 2026-11-22 12:34 - Vault selection clarity
- Simplify the card details panel and highlight the selected card in red.

## 2026-11-22 12:30 - Card deletion confirmation
- Show a branded confirmation dialog before deleting a vault card.

## 2026-11-22 12:27 - Three-column vault
- Separate the card list, certificate details, and card photo into equal desktop columns.

## 2026-11-22 12:23 - Vault card selection
- Switch selected vault cards in place while keeping the vault URL unchanged.

## 2026-11-22 12:20 - Vault card management
- Show certificate information in a wider vault detail panel, with owner-only editing and card deletion that releases its certificate number.

## 2026-11-22 11:23 - Card photo preview sizing
- Fit the complete photo within the preview popup without a scrollbar.

## 2026-11-22 11:13 - Card photo preview
- Add a full-size popup preview for both selected card photos.

## 2026-11-22 11:10 - Card photo remove button
- Enlarge the remove button on front and back photo previews.

## 2026-11-22 11:08 - Card identification guidance
- Refresh the card identification guidance with a shorter, more inviting message.

## 2026-11-22 11:06 - Card intake screen space
- Expand the intake panels to fill available screen height and distribute the form rows evenly.

## 2026-11-22 11:02 - Home footer alignment
- Match the home footer position to the register page on desktop.

## 2026-11-22 11:00 - Notes field spacing
- Align the optional Notes field and preserve consistent spacing as it is resized.

## 2026-11-22 10:58 - Compact card intake
- Reduce desktop form spacing so the intake page and footer fit more comfortably on screen.

## 2026-11-22 10:57 - Browser tab icon
- Show the DCR logo in the browser tab.

## 2026-11-22 10:54 - Card intake details
- Expand card image previews and require core card details; add optional artist and private notes with Vault editing.

## 2026-11-22 10:48 - Certificate label codes
- Link each label QR to its public certificate and keep both barcodes tied to the saved Cert number.

## 2026-11-22 10:46 - Remove old intake route
- Remove the unused /search redirect now that card intake uses /register.

## 2026-11-22 10:44 - Register page
- Rename the Add Card URL to /register, preserve old links, and reduce desktop vertical spacing.

## 2026-11-22 10:40 - Condition grade guidance
- Show PSA grade equivalents in the Add Card condition selector while retaining the existing saved condition.

## 2026-11-22 10:36 - Add Card section headings
- Remove the numbered badges from the card image and details sections.

## 2026-11-22 10:34 - Card photo uploads
- Refresh the front and back photo dropzones with larger previews and an on-image remove control.

## 2026-11-22 10:23 - Card details form layout
- Give the card name a full row and place the certificate number beside condition with consistent row spacing.

## 2026-11-22 10:18 - Add Card page layout
- Reduce vertical spacing and keep the footer at the bottom when the form fits on screen.

## 2026-11-22 10:16 - Home shortcuts
- Link home feature cards to Add Card, My Vault, and Labels with new icons, and align the slimmer search bar with the cards.

## 2026-11-22 10:09 - Home search and feature cards
- Compact the certificate search, clarify its instructions, and frame the three home features.

## 2026-11-22 10:04 - Certificate search placeholder
- Match the certificate search placeholder text and typography to the reference.

## 2026-11-22 10:04 - Home page layout
- Update the home page with feature icons and a full-height layout that places the footer at the bottom.

## 2026-11-22 09:54 - Responsive home headline
- Scale the home headline to its available width so each phrase fits on its own line.

## 2026-11-22 09:52 - Home page messaging
- Refresh the home page headline and description, and remove the redundant brand label.

## 2026-11-22 09:46 - Red navigation bar
- Use a red navigation bar with white text and a larger DCR brand.

## 2026-11-22 09:45 - Global Source Serif 4 font
- Use the self-hosted Source Serif 4 font throughout the app and privacy policy.

## 2026-11-22 09:42 - Global Playfair Display font
- Use the self-hosted Playfair Display font throughout the app and privacy policy.

## 2026-11-22 09:35 - Larger website text
- Increase text sizes throughout the app and privacy policy for better readability.

## 2026-11-22 09:28 - Global Instrument Serif font
- Use the self-hosted Instrument Serif font throughout the app and privacy policy.

## 2026-11-22 09:23 - Certificate viewer image size
- Enlarge the viewer image and reduce the footer text size to make better use of the screen.

## 2026-11-22 09:23 - Production site address
- Deploy the site to dcrcards.pages.dev and retain the existing project for image authorization and older links.

## 2026-11-22 09:17 - Certificate viewer copyright text
- Complete the DCR attribution and copyright text below certificate images.

## 2026-11-22 09:14 - Certificate viewer home link
- Replace the viewer instruction with a linked DCR Card Vault attribution.

## 2026-11-22 09:11 - Stable certificate viewer layout
- Keep the viewer controls, thumbnails, and text in place when switching between images of different sizes.

## 2026-11-22 09:09 - Larger certificate images
- Scale certificate viewer images to use the available screen height while preserving their proportions.

## 2026-11-22 09:07 - Certificate download filenames
- Name downloaded images using the certificate number and selected side.

## 2026-11-22 09:04 - Certificate image download
- Add a download button for the selected image in the certificate viewer.

## 2026-11-22 09:02 - Certificate brand and year order
- Place Brand/Title before Year in certificate information.

## 2026-11-22 09:02 - Certificate field order
- Place Card Name before Set Name in certificate information.

## 2026-11-22 08:54 - Certificate information formatting
- Place Language last and use title case for item labels while keeping values uppercase.

## 2026-11-22 08:51 - Uppercase certificate information
- Display all item information in uppercase on certificate records.

## 2026-11-22 08:50 - Certificate information
- Show the saved condition, full language name, and Brand/Title on certificate records while preserving printed collector numbers.

## 2026-11-22 08:49 - Login page redesign
- Refresh the login page with the Discovery artwork, gentle motion, and clearer sign-in copy.

## 2026-11-22 08:46 - Illustrated login concepts
- Add five animated login previews with newly generated collector-themed imagery.

## 2026-11-22 08:42 - Login design concepts
- Add five standalone login design previews for review, with the existing Google sign-in represented as a mockup.

## 2026-11-22 08:32 - Certificate URLs
- Use /cert/<number> links for certificate searches while keeping existing verify links working.

## 2026-11-22 08:28 - Clean page URLs
- Use clean paths throughout the app and preserve existing hash links.

## 2026-11-22 08:25 - Certificate page cleanup
- Remove the redundant record found badge from certificate details.

## 2026-11-22 08:22 - Certificate detail page
- Show a searchable certificate record with card information, uploaded photos or a labeled catalog reference, and an enlarged image viewer.

## 2026-11-22 02:25 - Vault reference images
- Show matched catalog reference images in My Vault, falling back to the saved front photo when a reference is unavailable.
- Publish the local image index's public source URLs; image files remain in the local library and the source hosts serve them on demand.

## 2026-11-22 02:15 - On-demand card reading details
- Keep identification results available from the Card details information button without opening a dialog automatically.
- Disable and gray out identification while reading and show errors inline.

## 2026-11-22 01:52 - Prevent conflicting candidate selection
- Reject catalog candidates that conflict with the printed reading instead of combining their identities.
- Keep card saving independent of label layout and retain a failed save outcome when a retry succeeds.

## 2026-11-22 01:51 - Card evidence enrichment
- Add sourced Thai Charizard HP and illustrator and Japanese promo release year for review.

## 2026-11-22 01:49 - Metadata evidence validation
- Validate field evidence records and report catalog coverage per set in addition to language.

## 2026-11-22 01:47 - Card metadata audit and workflow
- Add a reproducible catalog coverage audit, field-level evidence examples, and an identification-to-form guide.

## 2026-11-22 01:21 - Preserve imported card images
- Add pinned image importers and preserve verified external images across catalog refreshes.

## 2026-11-22 01:25 - Clear outdated photo readings
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

## 2026-11-22 01:08 - Front photo review notice
- Warn when card details remain after the front photo changes.


## 2026-11-22 01:06 - Promo number matching
- Interpret an alphanumeric collector suffix as a promo set code rather than a numeric set count.


## 2026-11-22 01:03 - Card identification safeguards
- Avoid silently filling unverified set, year, and rarity values; flag conflicting anniversary readings for review.
- Retry catalog loading after a failure and invalidate the previous photo identity when the front image changes.


## 2026-11-22 00:21 - Expand multilingual set reference
- Add sourced set-name and identifier snapshots across 15 languages, additional Japanese references, and the Thai MA6 example.


## 2026-11-22 00:12 - Set code research reference
- Add a multilingual set inventory, pinned English abbreviation source, and guidance distinguishing printed marks, catalog IDs, and promo identifiers.

## 2026-11-21 20:54 - Preserve card reading values
- Fill available English set and year readings even when the printed-language catalog has no match; mark unmatched readings for review.
- Distinguish an unavailable catalog from a missing record and show the English set reading in the identification dialog.

## 2026-11-21 20:50 - Restore application startup
- Reuse the shared language check in card identification to avoid invalid JavaScript syntax that prevented the entire app from loading.
- Add a JavaScript syntax regression test for the card identification page and run application tests before deployment.

## 2026-11-21 20:46 - Printed card identity review
- Read printed collector numbers, set codes, symbols, stamps and copyright separately before suggesting a printing.
- Match the original-language catalog by set and collector number, check known denominators and conflicting card details, and keep unverified English counterparts out of the form.
- Show the original collector number and make missing catalog matches and unverified translations clear during intake.

## 2026-11-21 07:59 - Localized card matching and automatic rarity
- Fail over across configured Gemini keys on non-quota key, configuration, timeout, network, and upstream errors; keep quota/rate-limit responses terminal.
- Keep the existing single Gemini key as a final fallback when a multi-key pool is configured.
- Read the full visible card with an English Gemini prompt, including attack/ability effects, printed text, regulation mark, and per-field confidence.
- Match the printed-language catalog record and metadata first, map it to English label data, auto-fill only a unique high-confidence identity, and show source-language images for review choices.
- Fill the read-only rarity field from the selected English card record or reviewed uniform set default; keep unknown rarity blank.

## 2026-11-21 06:55 - Cloudflare fetch redirect compatibility
- Use Cloudflare Workers-supported manual redirects for Gemini, Oracle OCR, and Oracle media requests; upstream redirects are not followed.
- Cover the supported redirect mode in the card-identification regression test.

## 2026-11-21 06:45 - Gemini network failure fallback
- Use the deployed Oracle OCR pipeline when Gemini cannot be reached or returns no usable identity fields.
- Preserve safe fetch failure diagnostics (error name/code and elapsed time) without logging request data or credentials.
- Disclose the Oracle OCR fallback in Add Card and documentation.

## 2026-11-21 06:12 - Gemini transient failure recovery
- Retry Gemini once after a network error or upstream 5xx, without retrying quota, configuration, or timeout failures.
- Return a privacy-safe request reference for reading failures and log it with the failure class and upstream status for diagnosis.
- Show the short reference in the Add Card error state so a future production failure can be matched to Cloudflare logs.

## 2026-11-21 05:55 - Gemini card identification
- Replaced Oracle OCR and Gemma fallback calls in Add Card with one server-side `gemini-3.5-flash-lite` image-reading request.
- Added structured field parsing, safe quota/configuration errors, confidence-gated catalog auto-fill, and non-automatic English catalog review suggestions when an exact match is unavailable.
- Disclosed Gemini image processing in the Add Card intake flow and kept the API key out of Git and browser code.
- Kept Oracle media storage for saved card photos, removed unused OCR/Gemma Pages adapters and Workers AI binding, and documented the Gemini Pages secret requirement.

## 2026-11-20 19:32 - Oracle hostname routing
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

## 2026-11-22 - Separate profile editing
- Save profile photos independently from personal details and allow positioning photos with a circular crop guide.
