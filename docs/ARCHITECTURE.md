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

- `public/data/card-catalog.json` is a compact TCGdex metadata index generated from the pinned local catalog snapshot. It contains names, sets, years, collector numbers, languages, rarity, series IDs, card counts, and the card details used to identify a printing; it contains no card images or collection records.
- Add Card suggestions and saved card names/sets use English (`en`) catalog entries so printed labels stay in English. Image reading resolves an exact source-language catalog record from the printed name and exact set or collector number when available; any observed year, set, number, or denominator must agree. It then compares HP, illustrator, stage, types, attacks, and weakness against English rows. It keeps source language/set/number for label-profile checks and only auto-fills when one English identity has strong, independent matching evidence. Otherwise, only credible close alternatives appear in the picker. English catalog details supply the label name, set, year, and set-scoped rarity choices; intake and label printing reject non-Latin name/set text.
- Candidate previews use the exact source-language card image through a same-origin image endpoint, with a direct TCGdex URL fallback for that same image only. If the source image is unavailable, no other printing's artwork is substituted.

## OCR-first image intake

- On explicit button click, the authenticated `/api/cards/identify` Pages Function sends the front image to the private Oracle OCR endpoint first. Oracle runs the existing `image_to_label.py` OCR-first lookup-only path: PaddleOCR, the card-key parser, catalog recovery, and `lookup_card.py`. The image and per-scan files stay in a temporary directory and are deleted when the request ends.
- A unique exact source-language catalog match is returned directly. When that record has the same exact TCGdex card ID in the English web catalog, the browser selects it and fills the label fields without opening the picker.
- Only OCR that is unavailable, incomplete, ambiguous, conflicting, or unmatched invokes the fixed `@cf/google/gemma-4-26b-a4b-it` Workers AI model. Its visible-text reading supplements missing or low-confidence OCR keys, then Oracle runs the same `lookup_card.py` decision rules again. High-confidence OCR keys are kept; model-derived identity must still agree with the local catalog and pass its ambiguity/conflict rules. If the source print cannot be mapped to one English catalog record, credible alternatives are shown for review.
- The web label editor reads the saved D1 card and does not call Gemma. The image, OCR reading, and model result are not written to D1 or Oracle image storage. Matching remains a draft; nothing is saved until Add to Vault is clicked.
- Catalog records provide set card counts for checking printed denominators. A missing or conflicting denominator blocks an exact source match. Missing rarity stays blank unless the verified English catalog counterpart supplies a set-scoped rarity.

## Data flow

```text
Google Identity Services
  -> Pages Function verifies ID token
  -> users + sessions in D1
  -> HttpOnly session cookie
  -> authenticated Pages Function APIs
  -> Oracle PaddleOCR -> existing parser/catalog recovery/matcher
  -> Gemma 4 only for unresolved OCR -> same catalog matcher
  -> exact English card ID mapping or credible candidate review
  -> owner-scoped card and image metadata in D1
  -> one-use capability -> Oracle image service on the VM
  -> src/store/cards.js -> vault, search, verify, and label pages
```

## Project conventions

- One page per file in `src/pages/`; reusable UI in `src/components/`.
- API shared modules live in `functions/_utils/`; underscore-prefixed folders are not routes.
- D1 schema history lives in `migrations/` and is applied by the deployment workflow before publishing new code.
- The Oracle image and OCR identification services are separate loopback-only processes under `storage-service/`; Nginx exposes only their explicit HTTPS routes to Pages.
- Google token verification uses the Workers Web Crypto API and Google's published JWK set. No authentication library is added, so runtime dependencies stay small.
- Inter and Noto Sans Thai are self-hosted under `public/assets/fonts/` with their OFL licenses.
- Label rendering imports the approved SVG masters from `dcr-tag-70x20/` and uses the browser-side `qrcode` and `jsbarcode` packages to create test QR and Code 128 symbols without sending certificate values to an external service.
