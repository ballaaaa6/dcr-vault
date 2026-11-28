# Architecture

## Application runtime

- Vite builds the browser application into `dist/`; Cloudflare Pages serves it.
- Pages Functions live in `functions/` and provide same-origin authentication and card APIs.
- Cloudflare D1 stores user profiles, hashed session identifiers, and card records.
- The browser uses `src/store/cards.js` as an API client. D1 is the source of truth for signed-in accounts.
- Card identification uses lottie-web to render the original [scanner animation by Karma Tsewang](https://lottiefiles.com/free-animation/scanner-p04CUNQy2m), distributed under the Lottie Simple License. The local animation data is tinted and its white background removed for the photo overlay.

- Certificate image export uses html2canvas to capture the rendered public card details and photos as a PNG. Images are fetched before capture so failed or inaccessible photos cannot silently disappear from the export.

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
- Collections reuse owner-scoped Vault membership. Owners may enable a random, revocable link for a collection; its public API selects only the collection name, description, selected cards' public certificate fields, and front photo routes. The link is a bearer capability: anyone who has it can view and forward it, and turning it off invalidates that link. Disabling a collection link does not revoke the independently public certificates or photos.
- Front and back photos are stored on the Oracle VM under opaque owner/card UUIDs. D1 stores each side's object key, MIME type, size, and digest; the browser only receives same-origin image routes.
- Saved card photos use private browser caching with digest-based revalidation on every reuse; a missing or changed image cannot receive a stale 304 response. Shared caches must not store these responses.
- The image service generates small (240px) and medium (1000px) WebP variants on demand using Pillow, with SHA-256 verification and a two-conversion limit. Variants are removed on replacement or deletion; the original remains the fallback. Vault prefetch is limited to nearby rows and respects data-saving mode.
- Pages Functions check the card owner for image changes; public photo reads and owner changes use one-use, short-lived image capabilities. The Oracle service consumes each capability by calling the private-card API and never receives the user's DCR session cookie or a long-lived storage token.
- Existing `dcr-cards-v1` browser records are never uploaded automatically. After first sign-in on a browser, the user reviews every card name and Cert number and selects which records to import. The legacy copy is retained either way, and images are excluded.

## Card identification

- Add Card sends the selected front photo to the authenticated Pages Function, which sends it with an English prompt and structured JSON schema to Gemini 3.5 Flash. The server keeps API keys private and rotates configured keys through D1. Quota errors do not trigger key switching.
- Gemini reads printed names, numbers and classification, and may infer the set, release year and rarity code. Promotional printings use Promo across games. It returns one set name in the card language and a release year, without requesting a missing-year explanation. It is asked to capitalize English form values while preserving names and codes. The user reviews and can edit all values.
- The intake form uses the Gemini result directly and does not match or fill it from the card catalog. An unreadable field remains editable. The set field uses the returned set name; the year uses release year only. Card names retain their printed-language script. Condition and certificate number are entered by the user. Identification logs retain model explanations and field status for seven days.
- D1 stores game, category, color elements and subtype as shared fields for all games. Vault, certificates and labels use those saved details. Saved card images, not catalog reference images, are used in Vault.
- Identification is a draft. A limited raw and normalized reading is logged for seven days; the photo is not stored until the card is saved and its separate photo upload succeeds.

## Data flow

```text
Google Identity Services
  -> Pages Function verifies ID token
  -> users + sessions in D1
  -> HttpOnly session cookie
  -> authenticated Pages Function APIs
  -> Gemini 3.5 Flash returns the structured card reading
  -> normalize the reading without a catalog lookup
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
- Source Serif 4 is self-hosted under `public/assets/fonts/` with its OFL license.
- Label rendering imports the approved SVG masters from `dcr-tag-70x20/` and uses the browser-side `qrcode` and `jsbarcode` packages to create test QR and Code 128 symbols without sending certificate values to an external service.
- Label lines reserve a 2 mm gap between the left and right fields. When a line exceeds its available width, rendering abbreviates eligible words to initials from right to left and checks the result before printing; saved card details remain unchanged.

## Rarity display

- Intake converts known rarity names and legacy codes to one shared display value. Saved rarity is used on labels with the same shared conversion for legacy records; Promo remains Promo. Unknown names remain intact, and label width is checked before saving.
- Localized source rarity is looked up only with a unique matching language, printed name, set code, and collector number. English catalog matches with a conflicting year are flagged for review. English rarity used as a fallback for a localized card is flagged for verification.

## Label PDF export
- Use jsPDF to create a single A4 PDF with alternating front and back pages for each 40-label sheet. The exporter inlines the label SVGs and uses svg2pdf.js to preserve vector artwork instead of rasterizing the sheet. The back master's constant-color SVG filter is converted to equivalent solid fills because svg2pdf.js does not support that filter. PDF viewers may show fine seams when antialiasing adjacent shapes.

- Sheet cut guides are 0.10 mm wide, centered on cell boundaries, and stop 2 mm outside the label grid.

- The shared options icon uses the [useAnimations Settings animation](https://useanimations.com/icons/settings), under the MIT license; its shared SVG stays mounted while CSS animates the gear.
