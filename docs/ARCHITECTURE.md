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
- The homepage is public, while vault, add, label, and certificate lookup routes require a session.
- Card details, certificate numbers, prices, purchase/sale dates, sources, and notes are stored in D1 and are returned only to that card's owner.
- Card photos are not uploaded or stored by the current app. Browser migration excludes images.
- Existing `dcr-cards-v1` browser records are never uploaded automatically. After first sign-in on a browser, the user reviews every card name and Cert number and selects which records to import. The legacy copy is retained either way, and images are excluded.

## Data flow

```text
Google Identity Services
  -> Pages Function verifies ID token
  -> users + sessions in D1
  -> HttpOnly session cookie
  -> authenticated Pages Function APIs
  -> owner-scoped card queries in D1
  -> src/store/cards.js -> vault, search, verify, and label pages
```

## Project conventions

- One page per file in `src/pages/`; reusable UI in `src/components/`.
- API shared modules live in `functions/_utils/`; underscore-prefixed folders are not routes.
- D1 schema history lives in `migrations/` and is applied by the deployment workflow before publishing new code.
- Google token verification uses the Workers Web Crypto API and Google's published JWK set. No authentication library is added, so runtime dependencies stay small.
- Inter and Noto Sans Thai are self-hosted under `public/assets/fonts/` with their OFL licenses.
