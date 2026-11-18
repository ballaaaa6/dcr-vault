# Deployment

## Local
npm install && npm run dev

## GitHub
- Create repo dcr-card-vault
- git init, git add ., git commit -m "feat: initial DCR vault"
- Do NOT push .env, node_modules, dist, large photos.
- Change admin password before public push: use Cloudflare Access or env.

## Cloudflare Pages
- Connect GitHub repo, Build command: npm run build, Output: dist
- This app currently builds as a static front end. Its demo login is client-side and the card data stays in each browser's local storage; Pages environment variables do not secure that login or sync data.
- For private use, put Cloudflare Access in front of the site or implement server-side authentication before storing personal collection data.
- For cross-device sync, connect a backend such as D1 and update the app data layer; creating a D1 database alone does not enable sync.
- D1 schema reference: [DATA-MODEL.md](DATA-MODEL.md)

## Oracle Object Storage
- Bucket: dcr-card-images, public read for card images only
- Store URL in D1, not base64 in DB for prod.
