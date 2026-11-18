# DCR Card Vault

Private collection vault for DCR certified cards. The login page uses the official DCR mark and a responsive split layout. Google sign-in automatically creates an account for any user who signs in successfully.

## Local preview

1. Install dependencies: `npm install`
2. Start Vite: `npm run dev`
3. Open [http://localhost:5173](http://localhost:5173)

Vite preview serves the browser UI only. Google sign-in, account sessions, and private card data require Cloudflare Pages Functions and the D1 binding; see [deployment setup](docs/DEPLOYMENT.md).

## Main menus

- Home / Certificate Search
- Add Card
- My Vault
- Labels

Private routes require sign-in. Certificate lookup searches only the signed-in user's records. Buy and sell prices stay in Vault and never appear on labels.

## Account and data

- Google sign-in requests basic profile identity only; DCR Vault does not read Gmail messages.
- Account identity, sessions, and card records are stored in Cloudflare D1. Session cookies are HttpOnly and only their hashes are stored in D1.
- Each user's card records are isolated by an owner ID in every server query.
- Legacy browser data is offered for import after sign-in. The user chooses whether to import, the original local copy is retained, and images are not imported.

## Labels

- Labels are 70 × 20 mm; A4 sheets hold 40 label positions.
- Labels show the card name, set, year, number, rarity, grade, Cert number, DCR mark, and barcode/QR area.
- Buy and sell prices and collection notes stay private in Vault and never appear on a label.

## Workspace layout

- `src/`: browser pages, components, API client, and styles
- `functions/`: Cloudflare Pages authentication and card APIs
- `migrations/`: versioned D1 schema
- `public/`: static web assets
- `docs/`: architecture, data model, design, deployment, and code rules
- `dcr-tag-70x20/`: separate card lookup and label-generation toolkit

See [architecture](docs/ARCHITECTURE.md), [data model](docs/DATA-MODEL.md), [deployment setup](docs/DEPLOYMENT.md), [design system](docs/DESIGN-SYSTEM.md), [label specification](docs/LABEL-SPEC.md), and [code rules](docs/CODE-RULES.md).
