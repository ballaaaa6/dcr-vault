# Deployment and Authentication Setup

## Current production target

- Site: https://dcr-vault.pages.dev
- Pages project: `dcr-vault`
- The project uses Direct Upload. `.github/workflows/pages-deployment.yml` builds the site and deploys with Wrangler; Functions are included from the root `functions/` directory.
- The workflow applies pending D1 migrations before deployment. It skips publishing if Google OAuth, D1, or the validated Oracle origin configuration is missing.

## One-time Google sign-in setup

1. In Google Cloud Console, configure an External OAuth app for DCR Card Vault and select a support email. The current app is in Testing status.
2. Create a Web application OAuth client with authorized JavaScript origins `https://dcr-vault.pages.dev` and `http://localhost:5173`.
3. Add the client ID as the GitHub Actions repository variable `GOOGLE_CLIENT_ID`. It is a public identifier, not a client secret. The app requests only the basic sign-in scopes `openid`, `email`, and `profile`; it does not request Gmail API access.
Google's current OAuth app-state documentation says external apps in Testing are generally limited to test users, but apps that request only `openid`, `email`, and `profile` are an exception and can be accessed by any Google account. Users may still see a testing notice. This setup is intended to allow self-registration with those basic scopes.

The `pages.dev` origin is the production site and is used directly for sign-in. Publishing the app and verifying its branding requires completing the Branding page and verifying the domains in Google Search Console. The shared `pages.dev` domain does not prove ownership; use a custom domain you control if you later need published, verified branding. The current basic-identity sign-in does not require publishing or a custom domain.

Google's ID token is verified by the server before account creation. Do not replace this with browser-only checks or store the token in local storage.

## One-time D1 setup

1. Create a Cloudflare D1 database named `dcr-vault` in the account used by Pages. This deployment uses Cloudflare's automatic nearest-region placement.
2. Add the returned database UUID as the GitHub Actions repository variable `CLOUDFLARE_D1_DATABASE_ID`.
3. Create a separate Cloudflare API token with only Account `D1: Edit` permission and add it as the GitHub Actions secret `CLOUDFLARE_D1_API_TOKEN`. This token expires on 2027-11-19. Keep the existing `CLOUDFLARE_API_TOKEN` Pages deployment token limited to Pages Edit.
4. Keep `CLOUDFLARE_ACCOUNT_ID` configured as a GitHub Actions secret.
5. Once all values are present, the next push applies pending migrations, adds the D1 binding `DB`, `GOOGLE_CLIENT_ID`, and `ORCL_MEDIA_ORIGIN` generated from `ORCL_SERVICE_ORIGIN` to the Pages deployment, then publishes the site. Add `GEMINI_API_KEYS` as a Cloudflare Pages secret before using card identification; it must never be a repository variable or browser setting.

## Gemini card-reading secret

The Add Card identification Function calls `gemini-3.5-flash-lite` directly from Cloudflare Pages. Set `GEMINI_API_KEYS` as a Pages secret for the `dcr-vault` project, with one key per line. The server remembers a working key per isolate and advances only when Google explicitly rejects a key. A quota/rate-limit response is returned immediately without trying another key. The legacy single-key `GEMINI_API_KEY` secret remains supported. Use a newly issued key if a prior key was pasted into a chat or committed by mistake. Do not put keys in source, `wrangler.template.toml`, GitHub Actions logs, or browser code. Wrangler can add the pool with `npx wrangler pages secret put GEMINI_API_KEYS --project-name dcr-vault`, reading the value from secure input; never append key values as command arguments.

After a signed-in user clicks Identify card, the Add Card request sends the front image to Google's Gemini API. Gemini returns a direct card identification and evidence; an optional exact English catalog lookup adds catalog and label metadata. The identification endpoint does not save the image or reading. The user reviews the filled form and clicks Add to Vault to save card details and photos.

## Oracle origin hostname

Cloudflare Workers cannot make outbound subrequests to IP-literal URLs. The production Oracle origin is `https://217-142-238-24.sslip.io`, which `sslip.io` resolves to the VM at `217.142.238.24`. The site's shared `dcr-vault.pages.dev` hostname is not a DNS zone we control, so it cannot be pointed at the Oracle VM. `sslip.io` is an external DNS dependency for saved-card image storage.

The Oracle VM has a Let's Encrypt certificate for `217-142-238-24.sslip.io`, and Nginx serves the hostname over HTTPS while keeping both services bound to loopback. GitHub Actions uses the repository variable `ORCL_SERVICE_ORIGIN=https://217-142-238-24.sslip.io` for saved-card media requests. The workflow rejects IP literals and invalid HTTPS origins, and skips production deployment if this variable or other required configuration is missing. The Add Card identification endpoint no longer calls `/ocr/v1/identify`.

The hostname configuration was deployed successfully on 2026-11-20 in [GitHub Actions run 44743693723](https://github.com/ballaaaa6/dcr-vault/actions/runs/44743693723). To migrate image storage to a domain you own later, issue a certificate for its hostname, update `ORCL_SERVICE_ORIGIN`, and deploy again.

## Gemini card reading

- Add Card sends one authenticated, 10 MB-bounded front image from `/api/cards/identify` to Google's `gemini-3.5-flash-lite` API. The Pages Function supplies a structured JSON schema and an `x-goog-api-key` header sourced from the `GEMINI_API_KEYS` Pages secret (or the legacy `GEMINI_API_KEY` secret). Gemini returns the direct identification, evidence, English form fields when clear, and uncertainty notes. The browser fills those values and only uses the catalog to attach a unique exact record; catalog absence does not suppress the reading. API keys are never returned to the browser.
- The reading keeps collector number separate from Pokédex number, level, and copyright year, and separates finish from rarity. The user reviews and can edit the filled English details before saving. Label printing still requires a supported rarity and approved English year/series or verified localized label profile.
- The photo and reading are transient in the identification path. Google handles the image for model inference; the identification API does not call the OCR service. No card is saved until Add to Vault is clicked.
- A 429 response means the model/project quota was reached; the server does not try another key for this response. Invalid-key responses may advance to the next configured key. Other missing/invalid settings and upstream failures are logged with privacy-safe request references. Gemini retries once after network or upstream 5xx failures using the same key.
- For local Pages Function development, place newline-separated `GEMINI_API_KEYS` (or the legacy `GEMINI_API_KEY`) in the ignored `.dev.vars` file and run Wrangler Pages with the configured D1 binding, for example `npx wrangler pages dev dist --d1 DB=<database-id>`. `npm run dev` alone serves only the Vite front end and does not provide the analysis API.

The workflow generates a temporary `wrangler.toml` from `wrangler.template.toml`. The generated file is ignored by Git; do not commit account-specific IDs or credentials.

## Automatic deployments

- Pushes to `main` trigger build, D1 migration, then Cloudflare Pages deployment.
- Workflow dispatch remains available in GitHub Actions.
- If required OAuth, D1, or Oracle origin settings are missing, CI builds the app and reports that production deployment was skipped.
- The Pages deployment token expires on 2027-11-19. Rotate it before that date and update `CLOUDFLARE_API_TOKEN`.

## Data and local development

- Pages Functions and D1 are required for Google sign-in and private card storage; `npm run dev` alone serves only the Vite front end.
- Once D1 is configured, use Wrangler Pages local development with the D1 binding, for example `npx wrangler pages dev dist --d1 DB=<database-id>`.
- `ORCL_MEDIA_ORIGIN` points to the hostname-backed HTTPS reverse proxy on the Oracle VM for saved card photos. Keep the Oracle services loopback-only; Add Card identification uses Gemini directly.
- The Add Card suggestions are a static TCGdex metadata index. Refresh it by running `npm ci --prefix dcr-tag-70x20/catalog`, `python dcr-tag-70x20/catalog/import_tcgdex_catalog.py`, and `python tools/build-card-catalog-index.py`.
- The legacy `dcr-cards-v1` browser data is offered for an explicit import after sign-in. Import does not delete the local copy, and images are excluded.
- Do not commit `.env`, `.dev.vars`, credentials, `node_modules`, `dist`, card scans, or private collection exports.

## References

- D1 schema and ownership rules: [DATA-MODEL.md](DATA-MODEL.md)
- Project runtime and auth flow: [ARCHITECTURE.md](ARCHITECTURE.md)
