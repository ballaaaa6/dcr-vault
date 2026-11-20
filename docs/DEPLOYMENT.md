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
5. Once all values are present, the next push applies pending migrations, adds the D1 binding `DB`, Workers AI binding `AI`, `GOOGLE_CLIENT_ID`, and the Oracle origins generated from `ORCL_SERVICE_ORIGIN` to the Pages deployment, then publishes the site. These settings are configured for the current production deployment.

## Oracle origin hostname

Cloudflare Workers cannot make outbound subrequests to IP-literal URLs. The production Oracle origin is `https://217-142-238-24.sslip.io`, which `sslip.io` resolves to the VM at `217.142.238.24`. The site's shared `dcr-vault.pages.dev` hostname is not a DNS zone we control, so it cannot be pointed at the Oracle VM. `sslip.io` is an external DNS dependency; if it stops resolving this hostname, the Oracle OCR and media routes will be unavailable until the origin is moved to another DNS hostname.

The Oracle VM has a Let's Encrypt certificate for `217-142-238-24.sslip.io`, and Nginx serves the hostname over HTTPS while keeping both application listeners bound to loopback. GitHub Actions uses the repository variable `ORCL_SERVICE_ORIGIN=https://217-142-238-24.sslip.io` for both `ORCL_MEDIA_ORIGIN` and `ORCL_OCR_ORIGIN`. The workflow rejects IP literals and invalid HTTPS origins, and skips production deployment if this variable or other required configuration is missing. `ORCL_OCR_TOKEN` remains a separate Pages secret.

The hostname configuration was deployed successfully on 2026-11-20 in [GitHub Actions run 44743693723](https://github.com/ballaaaa6/dcr-vault/actions/runs/44743693723). The authenticated Oracle OCR endpoint was also tested directly with the supplied card scan and returned HTTP 200 with `matched_preview` and one catalog candidate. To migrate to a domain you own later, issue a certificate for its hostname, update `ORCL_SERVICE_ORIGIN`, and deploy again.

## OCR-first card reading

- Add Card sends the authenticated, 10 MB-bounded front image to Oracle at `ORCL_OCR_ORIGIN` first. Oracle runs the existing `image_to_label.py` OCR-first lookup-only path: PaddleOCR first, then system Tesseract if Paddle crashes, times out, or returns invalid output. The service asks the parser to detect the printed script and runs the same catalog recovery and `lookup_card.py` lookup. The image and per-scan files are held in a temporary directory and deleted when the request ends.
- Gemma 4 runs only when OCR cannot return a unique matched card. Its visible-text fields supplement missing or low-confidence OCR keys, then Oracle runs the same `lookup_card.py` matcher again. The browser auto-fills when the selected source record has an exact English TCGdex card ID; otherwise it uses the existing evidence-based catalog mapping and review picker.
- Production rollout completed on 2026-11-20: `dcr-vault-ocr.service` is enabled on the Oracle VM, using the existing OCR-first Python pipeline and the private catalog built from the pinned public snapshot. The catalog contains 42,599 cards and passed SQLite integrity validation.
- The deployed OCR route was verified directly through the production HTTPS hostname using the supplied Thai card image. The service returned `matched_preview` with one catalog candidate; the uploaded test image was removed from the VM after the request.
- The VM is Ubuntu 22.04 ARM64. PaddlePaddle 3.2.0 and PaddleOCR 3.7.0 import, but Paddle native inference can segfault on ARM64. Install `tesseract-ocr` and `tesseract-ocr-tha` on the host; the OCR service keeps Paddle primary and uses Tesseract as a reader fallback. The service health endpoint reports whether the fallback binary is available.
- The Python service binds only to `127.0.0.1:8790`. Nginx proxies `/ocr/v1/` while preserving the existing Node image-store listener on `127.0.0.1:8788`. The same random 64-character hex `DCR_OCR_TOKEN` is stored in root-only `/etc/dcr-vault-ocr.env` and in the production Cloudflare Pages secret `ORCL_OCR_TOKEN`. The token value is never stored in Git.
- Enable Workers AI on the Pages account for `@cf/google/gemma-4-26b-a4b-it`. The current [Gemma 4 model page](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/) lists $0.10 per million input tokens and $0.30 per million output tokens; this cost is incurred only on OCR fallback. The photo is not persisted by the Function; Oracle image storage still happens only through the separate Add to Vault save flow.
- For local Pages Function development, use Wrangler with the AI binding and configured D1 binding, for example `npx wrangler pages dev dist --ai AI --d1 DB=<database-id>`. `npm run dev` alone serves only the Vite frontend and does not provide the analysis API.

The workflow generates a temporary `wrangler.toml` from `wrangler.template.toml`. The generated file is ignored by Git; do not commit account-specific IDs or credentials.

## Automatic deployments

- Pushes to `main` trigger build, D1 migration, then Cloudflare Pages deployment.
- Workflow dispatch remains available in GitHub Actions.
- If required OAuth, D1, or Oracle origin settings are missing, CI builds the app and reports that production deployment was skipped.
- The Pages deployment token expires on 2027-11-19. Rotate it before that date and update `CLOUDFLARE_API_TOKEN`.

## Data and local development

- Pages Functions and D1 are required for Google sign-in and private card storage; `npm run dev` alone serves only the Vite front end.
- Once D1 is configured, use Wrangler Pages local development with the D1 binding, for example `npx wrangler pages dev dist --d1 DB=<database-id>`.
- The `ORCL_MEDIA_ORIGIN` and `ORCL_OCR_ORIGIN` variables point to the same hostname-backed HTTPS reverse proxy on the Oracle VM. Keep both Oracle services on loopback. If OCR is unavailable, Add Card falls back to Gemma and reports the OCR and fallback states separately.
- The Add Card suggestions are a static TCGdex metadata index. Refresh it by running `npm ci --prefix dcr-tag-70x20/catalog`, `python dcr-tag-70x20/catalog/import_tcgdex_catalog.py`, and `python tools/build-card-catalog-index.py`.
- The legacy `dcr-cards-v1` browser data is offered for an explicit import after sign-in. Import does not delete the local copy, and images are excluded.
- Do not commit `.env`, `.dev.vars`, credentials, `node_modules`, `dist`, card scans, or private collection exports.

## References

- D1 schema and ownership rules: [DATA-MODEL.md](DATA-MODEL.md)
- Project runtime and auth flow: [ARCHITECTURE.md](ARCHITECTURE.md)
