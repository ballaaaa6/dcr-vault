# Deployment and Authentication Setup

## Current production target

- Site: https://dcr-vault.pages.dev
- Pages project: `dcr-vault`
- The project uses Direct Upload. `.github/workflows/pages-deployment.yml` builds the site and deploys with Wrangler; Functions are included from the root `functions/` directory.
- The workflow applies pending D1 migrations before deployment. It skips publishing until Google OAuth and D1 credentials are configured, so an incomplete login setup is not pushed to production.

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
5. Once all values are present, the next push applies pending migrations, adds the D1 binding `DB`, Workers AI binding `AI`, `GOOGLE_CLIENT_ID`, and `ORCL_MEDIA_ORIGIN` to the Pages deployment, then publishes the site.

## Workers AI image reading

- The root `wrangler.template.toml` declares the Pages Workers AI binding as `AI`; the deployment workflow includes it in the generated Wrangler configuration. Enable Workers AI for the Cloudflare account used by the Pages project.
- The Add Card page calls Gemma 4 only after the user selects a front photo and clicks the analysis button. Each request is authenticated, accepts JPEG/PNG/WebP up to 10 MB, and uses `@cf/google/gemma-4-26b-a4b-it`. The photo is sent to Cloudflare for inference and is not persisted by the analysis Function; Oracle storage happens only through the separate Add to Vault save flow.
- The current [Gemma 4 model page](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/) lists $0.10 per million input tokens and $0.30 per million output tokens. Image token use varies with the photo; check the current model page and account allocation before large batches.
- For local Pages Function development, use Wrangler with the AI binding (for example, `npx wrangler pages dev dist --ai AI`) and the configured D1 binding. `npm run dev` alone runs only Vite and does not provide the analysis API.

The workflow generates a temporary `wrangler.toml` from `wrangler.template.toml`. The generated file is ignored by Git; do not commit account-specific IDs or credentials.

## Automatic deployments

- Pushes to `main` trigger build, D1 migration, then Cloudflare Pages deployment.
- Workflow dispatch remains available in GitHub Actions.
- Before OAuth and D1 setup is complete, CI builds the app and reports that production deployment was skipped.
- The Pages deployment token expires on 2027-11-19. Rotate it before that date and update `CLOUDFLARE_API_TOKEN`.

## Data and local development

- Pages Functions and D1 are required for Google sign-in and private card storage; `npm run dev` alone serves only the Vite front end.
- Once D1 is configured, use Wrangler Pages local development with the D1 binding, for example `npx wrangler pages dev dist --d1 DB=<database-id>`.
- The `ORCL_MEDIA_ORIGIN` variable points to the HTTPS reverse proxy on the Oracle VM. Keep the Node image service on loopback; enable the VM endpoint only after its public TLS certificate renews automatically and the OCI VCN permits the required web traffic.
- The Add Card suggestions are a static TCGdex metadata index. Refresh it by running `npm ci --prefix dcr-tag-70x20/catalog`, `python dcr-tag-70x20/catalog/import_tcgdex_catalog.py`, and `python tools/build-card-catalog-index.py`.
- The legacy `dcr-cards-v1` browser data is offered for an explicit import after sign-in. Import does not delete the local copy, and images are excluded.
- Do not commit `.env`, `.dev.vars`, credentials, `node_modules`, `dist`, card scans, or private collection exports.

## References

- D1 schema and ownership rules: [DATA-MODEL.md](DATA-MODEL.md)
- Project runtime and auth flow: [ARCHITECTURE.md](ARCHITECTURE.md)
