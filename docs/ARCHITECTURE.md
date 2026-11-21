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

- `public/data/card-catalog.json` is a compact TCGdex metadata index generated from the pinned local catalog snapshot. It contains names, sets, years, collector numbers, languages, rarity, variants, series IDs, card counts, and localized attack/ability effects; it contains no card images or collection records.
- Identification first matches a card record in the printed language using name, language, collector number, set, HP, illustrator, attacks/effects, and visible finish. A source candidate needs at least two matching identity anchors (or a confident full collector number); confident HP, artist, type, attack, ability, and finish conflicts are rejected. English candidates are checked directly against the image reading, including translated attack names/effects and variant compatibility. Candidate ranking uses source-print evidence so unrelated target metadata cannot inflate a weak source match.
- Candidate options show the source-language name, set, number, and exact source-language artwork. Selecting an option fills the form and label from its English catalog counterpart, including the English name, set, year, collector number, and fixed per-card rarity. The source language and set remain attached for label-profile checks. A unique, high-confidence source and English match fills automatically; ambiguous matches stay in the picker.
- Candidate images use the exact source-language card image through a same-origin image endpoint, with a direct TCGdex URL fallback for that same image only. If the source image is unavailable, no other printing's artwork is substituted. The Add Card rarity field is read-only and filled from the English card record or a reviewed uniform set default; unknown rarity remains blank.

## Gemini image intake

- On explicit button click, the authenticated `/api/cards/identify` Pages Function validates the front image and sends it to the Gemini Developer API using the server-only `GEMINI_API_KEY` secret and the fixed `gemini-3.5-flash-lite` model. Its prompt requests exact source-language text, English attack equivalents when clear, per-field confidence, separate Pokédex/level fields, and visible finish (holo, reverse holo, glossy, or normal). If Gemini fails or has neither a confident full collector number nor two confident identity anchors, Pages sends the same image to the DCR OCR service on the Oracle VM and merges non-conflicting readings. A high-confidence disagreement on identity fields blocks catalog suggestions. Neither key is sent to the browser or written to D1.
- The browser exposes the recognized fields and confidence before showing candidates. It matches the source-language print from OCR evidence first, rejects confident conflicts, then checks English candidates directly against the read HP, artist, attacks/effects, and finish. A unique high-confidence source and English variant fills automatically; otherwise only candidates with a supported source-to-English mapping are offered. The selected English catalog ID, exact printed-language source card ID/set, and observed finish are stored for review and label resolution.
- If a safe unique match is not established, the picker shows source-language card images and printed details, alongside the English label mapping. It does not fall back to a broad English name-only list. If no English counterpart can be verified, the user enters the English card and set manually.
- Identification is a draft. The image and reading response are not written to D1 or Oracle image storage; the OCR service removes its temporary scan files after each request. No card is saved until Add to Vault is clicked. The separate image-save flow uses the Oracle media service.
- Catalog denominators are checked when visible. Missing or conflicting identity evidence blocks a confident match. Rarity is fixed by the selected English catalog card and fills automatically; missing rarity stays blank unless a reviewed uniform set default supplies it.

## Data flow

```text
Google Identity Services
  -> Pages Function verifies ID token
  -> users + sessions in D1
  -> HttpOnly session cookie
  -> authenticated Pages Function APIs
  -> Gemini 3.5 Flash-Lite reads card text and finish with field confidence
  -> Oracle OCR fallback if Gemini fails or lacks distinct identity evidence
  -> merge readings and stop on high-confidence disagreement
  -> source-language catalog match with conflict rejection
  -> English counterpart and print-variant match
  -> exact English card fill or review picker/manual entry
  -> owner-scoped card and image metadata in D1
  -> one-use capability -> Oracle image service on the VM
  -> src/store/cards.js -> vault, search, verify, and label pages
```

## Project conventions

- One page per file in `src/pages/`; reusable UI in `src/components/`.
- API shared modules live in `functions/_utils/`; underscore-prefixed folders are not routes.
- D1 schema history lives in `migrations/` and is applied by the deployment workflow before publishing new code.
- The Oracle image and OCR services are loopback-only processes under `storage-service/`; Nginx exposes their explicit HTTPS routes to Pages through the validated `ORCL_MEDIA_ORIGIN` hostname. Card identification uses OCR only as a fallback after Gemini fails or returns no identity fields.
- Google token verification uses the Workers Web Crypto API and Google's published JWK set. No authentication library is added, so runtime dependencies stay small.
- Inter and Noto Sans Thai are self-hosted under `public/assets/fonts/` with their OFL licenses.
- Label rendering imports the approved SVG masters from `dcr-tag-70x20/` and uses the browser-side `qrcode` and `jsbarcode` packages to create test QR and Code 128 symbols without sending certificate values to an external service.
