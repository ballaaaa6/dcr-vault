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

- Every card query and update includes the authenticated D1 user ID.
- Certificate numbers are unique inside one user's vault, not across all users.
- Cert input accepts one to eight digits; the server pads and stores the canonical eight-digit value before checking the per-user unique index.
- The homepage is public, while vault, add, label, and certificate lookup routes require a session.
- Card details, certificate numbers, prices, purchase/sale dates, sources, and notes are stored in D1 and are returned only to that card's owner.
- Front and back photos are stored on the Oracle VM under opaque owner/card UUIDs. D1 stores each side's object key, MIME type, size, and digest; the browser only receives same-origin image routes.
- Pages Functions check the card owner before issuing one-use, short-lived image capabilities. The Oracle service consumes each capability by calling the private-card API and never receives the user's DCR session cookie or a long-lived storage token.
- Existing `dcr-cards-v1` browser records are never uploaded automatically. After first sign-in on a browser, the user reviews every card name and Cert number and selects which records to import. The legacy copy is retained either way, and images are excluded.

## Card suggestions

- `public/data/card-catalog.json` is a compact TCGdex metadata index generated from the pinned local catalog snapshot. It contains names, sets, years, collector numbers, languages, and rarity; it contains no card images or collection records.
- Add Card filters that static index in the browser as the user types. Selecting a candidate fills the identifying fields while keeping Cert and grade independent.

## AI-assisted image intake

- On explicit button click, the authenticated `/api/cards/identify` Pages Function sends only the selected front image to the fixed `@cf/google/gemma-4-26b-a4b-it` Workers AI model. It does not write the image or model result to D1 or Oracle storage.
- The Function returns bounded text fields only. The browser ranks those fields against the static TCGdex index using name, set, year, collector number, rarity, and language evidence. A person selects a catalog candidate; the result is only a draft and nothing is saved until Add to Vault is clicked.
- The web label editor reads the saved D1 card and does not call Gemma. The separate offline label toolkit already has its own image/OCR-to-catalog lookup and ambiguity checks; it is not part of this Add Card AI path.
- Catalog rows may omit the full collector-number denominator or rarity. A missing catalog value stays blank for manual review; the app does not fill it from model guesses.

## Data flow

```text
Google Identity Services
  -> Pages Function verifies ID token
  -> users + sessions in D1
  -> HttpOnly session cookie
  -> authenticated Pages Function APIs
  -> Gemma 4 image reading -> static catalog candidate ranking -> user selection
  -> owner-scoped card and image metadata in D1
  -> one-use capability -> Oracle image service on the VM
  -> src/store/cards.js -> vault, search, verify, and label pages
```

## Project conventions

- One page per file in `src/pages/`; reusable UI in `src/components/`.
- API shared modules live in `functions/_utils/`; underscore-prefixed folders are not routes.
- D1 schema history lives in `migrations/` and is applied by the deployment workflow before publishing new code.
- The Oracle image service is a separate, loopback-only Node process under `storage-service/`; a public TLS reverse proxy is required for Pages-to-VM traffic.
- Google token verification uses the Workers Web Crypto API and Google's published JWK set. No authentication library is added, so runtime dependencies stay small.
- Inter and Noto Sans Thai are self-hosted under `public/assets/fonts/` with their OFL licenses.
- Label rendering imports the approved SVG masters from `dcr-tag-70x20/` and uses the browser-side `qrcode` and `jsbarcode` packages to create test QR and Code 128 symbols without sending certificate values to an external service.
