# Architecture

## Application runtime

- Vite builds the browser application into `dist/`; Cloudflare Pages serves it.
- Pages Functions live in `functions/` and provide same-origin authentication and card APIs.
- Cloudflare D1 stores user profiles, hashed session identifiers, and card records.
- The browser uses `src/store/cards.js` as an API client. D1 is the source of truth for signed-in accounts.

## Authentication and account creation

- The official Google Identity Services button returns a short-lived Google ID token.
- The Pages Function verifies the signature against Google's published keys and checks issuer, audience, expiry, verified email, and a one-time nonce.
- The first valid Google sign-in creates a DCR Vault account automatically. Any Google account with a verified email may register.
- Only Google name, email, profile image URL, and the stable Google subject identifier are used. The subject identifier stays server-side.
- DCR Vault does not request Gmail API access or read email messages.
- The browser receives a random `HttpOnly`, `SameSite=Lax` session cookie. D1 stores only its SHA-256 hash, scoped to one user and expiring after 30 days.

## Private card data

- Vault queries and updates include the authenticated D1 user ID.
- Certificate numbers are unique across all accounts, enforced by a database index.
- Cert input accepts one to eight digits; the server pads and stores the canonical eight-digit value before checking the global unique index.
- The homepage and certificate lookup are public; vault, add, and label routes require a session.
- Certificate details and card photos are public. Prices, purchase/sale dates, sources, notes, and account details are returned only to the owner.
- Front and back photos are stored on the Oracle VM under opaque owner/card UUIDs. D1 stores each side's object key, MIME type, size, and digest; the browser only receives same-origin image routes.
- Pages Functions check the card owner for image changes; public photo reads and owner changes use one-use, short-lived image capabilities. The Oracle service consumes each capability by calling the private-card API and never receives the user's DCR session cookie or a long-lived storage token.
- Existing `dcr-cards-v1` browser records are never uploaded automatically. After first sign-in on a browser, the user reviews every card name and Cert number and selects which records to import. The legacy copy is retained either way, and images are excluded.

## Card suggestions

- `public/data/card-catalog.json` is a compact TCGdex metadata index generated from the pinned local catalog snapshot. It contains names, sets, years, collector numbers, languages, rarity, variants, series IDs, card counts, and localized attack/ability effects; it contains no card images or collection records.
- Gemini identifies one card directly from the image using its visible name, artwork, attacks, HP, set code, collector number, rarity, and print marks. It returns the read details, short evidence, and fields that need review. Reading normalization fills rarity as `Promo` when Gemini leaves it blank but the printed set, set code, or collector number explicitly marks the card as a promo. The browser fills English form values from Gemini, then links a catalog record only when the exact English name/set/number resolves uniquely. Missing catalog data does not hide Gemini's answer; missing label series/profile data can still require correction before printing.
- Catalog suggestions use the exact card image for each catalog record through a same-origin image endpoint, with a direct TCGdex URL fallback for that same image only. If an image is unavailable, no other printing's artwork is substituted. The Add Card rarity field can be filled from Gemini or a selected catalog record and remains editable for correction.

## Gemini image intake

- On explicit button click, the authenticated `/api/cards/identify` Pages Function validates the front image and sends it to the Gemini Developer API using server-only `GEMINI_API_KEYS` (or legacy `GEMINI_API_KEY`) and the fixed `gemini-3.5-flash-lite` model. It advances to another configured key after key rejection, configuration errors, timeouts, network errors, or upstream failures; quota/rate-limit responses never trigger key switching. Gemini returns a direct identification, visible evidence, English form values where clear, and fields that need review. Pages returns that reading without OCR or catalog gates. No key is sent to the browser or written to D1.
- The browser fills the English name, set, year, printed card number, rarity, card type, language and parent series from Gemini's answer for user review. It then performs an optional exact catalog lookup to attach the card ID and approved label metadata. An absent or ambiguous catalog record leaves the reading visible and the form editable; the app does not substitute a same-name print. Label printing uses the reviewed series and label fields; older records can resolve a source-set series from the catalog, and missing series or unsupported languages block printing.
- Identification is a draft. The image and reading response are not written to D1 or Oracle image storage. No card is saved until Add to Vault is clicked. The separate image-save flow uses the Oracle media service.

## Data flow

```text
Google Identity Services
  -> Pages Function verifies ID token
  -> users + sessions in D1
  -> HttpOnly session cookie
  -> authenticated Pages Function APIs
  -> Gemini 3.5 Flash-Lite identifies the card and returns structured evidence
  -> optional exact English catalog lookup for approved label metadata
  -> editable intake form for user review
  -> owner-scoped card and image metadata in D1
  -> one-use capability -> Oracle image service on the VM
  -> src/store/cards.js -> vault, search, verify, and label pages
```

## Project conventions

- One page per file in `src/pages/`; reusable UI in `src/components/`.
- API shared modules live in `functions/_utils/`; underscore-prefixed folders are not routes.
- D1 schema history lives in `migrations/` and is applied by the deployment workflow before publishing new code.
- The Oracle image and OCR services are loopback-only processes under `storage-service/`; Nginx exposes their explicit HTTPS routes through the validated Oracle hostname. Saved-card image storage uses the image service; card identification sends the front image to Gemini and does not call OCR.
- Google token verification uses the Workers Web Crypto API and Google's published JWK set. No authentication library is added, so runtime dependencies stay small.
- Inter and Noto Sans Thai are self-hosted under `public/assets/fonts/` with their OFL licenses.
- Label rendering imports the approved SVG masters from `dcr-tag-70x20/` and uses the browser-side `qrcode` and `jsbarcode` packages to create test QR and Code 128 symbols without sending certificate values to an external service.
- Label lines reserve a 2 mm gap between the left and right fields. When a line exceeds its available width, rendering abbreviates eligible words to initials from right to left and checks the result before printing; saved card details remain unchanged.

## Rarity display

- Intake converts known rarity names and legacy codes to one shared display value. Saved rarity is used on labels with the same shared conversion for legacy records; Promo remains Promo. Unknown names remain intact, and label width is checked before saving.
- Localized source rarity is looked up only with a unique matching language, printed name, set code, and collector number. English catalog matches with a conflicting year are flagged for review. English rarity used as a fallback for a localized card is flagged for verification.

## Label PDF export
- Use jsPDF to create a single A4 PDF with alternating front and back pages for each 40-label sheet. Render approved sheet SVGs at 300 dpi so the browser can export their nested SVG artwork consistently.
