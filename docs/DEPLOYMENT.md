# Deployment

## Local
npm install && npm run dev

## Cloudflare Pages
- Production site: https://dcr-vault.pages.dev
- Cloudflare Pages project: `dcr-vault`; production branch: `main`.
- The existing project uses Direct Upload, which cannot be converted to Cloudflare's native Git integration. The GitHub Actions workflow at `.github/workflows/pages-deployment.yml` builds the app and uploads `dist` to this existing project with Wrangler.
- Pushes to `main` trigger deployment. The workflow can also be started manually from GitHub Actions.
- Add repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in GitHub. The token needs the account permission `Cloudflare Pages: Edit`. Until both secrets are configured, the workflow builds the site and reports that deployment was skipped.
- The current Pages deployment token expires on 2027-11-19. Rotate it before that date and update the `CLOUDFLARE_API_TOKEN` repository secret.
- Do NOT push `.env`, `node_modules`, `dist`, large photos, or private collection exports.
- This app currently builds as a static front end. Its demo login is client-side and the card data stays in each browser's local storage; Pages environment variables do not secure that login or sync data.
- For private use, put Cloudflare Access in front of the site or implement server-side authentication before storing personal collection data.
- For cross-device sync, connect a backend such as D1 and update the app data layer; creating a D1 database alone does not enable sync.
- D1 schema reference: [DATA-MODEL.md](DATA-MODEL.md)

## Oracle Object Storage
- Bucket: dcr-card-images, public read for card images only
- Store URL in D1, not base64 in DB for prod.
