# DCR Card Vault

Personal card vault with DCR certification labels. Theme: red and white only; use the official DCR logo.

## Quick start

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Open [http://localhost:5173](http://localhost:5173)

You can also open `index.html` directly for a limited static preview.

## Demo login

- Username: `admin`
- Password: `admin1234`
- The session lasts 24 hours in `sessionStorage`. See [deployment notes](docs/DEPLOYMENT.md) before publishing.

## Main menus

- Home / Certificate Search
- Add Card
- My Vault
- Labels

The app has no mobile app download page or real-time pricing.

## Label rules

- Labels are 70 × 20 mm; A4 sheets hold 40 labels with aligned front and back.
- A label shows only the name, set, year, card number, rarity, grade label, certificate number, QR code, and barcode.
- Buy and sell prices belong in Vault details and must never appear on a label.

## Storage and access

- Card data is stored in this browser's local storage. The current static deployment does not sync data between devices or users.
- The demo login is included in the public source and is not real access control. Do not enter private collection data until server-side authentication and storage or Cloudflare Access are configured.

## Workspace layout

- `src/`: web app pages, components, state, utilities, and styles
- `public/`: static web assets
- `tools/`: small web app utilities
- `docs/`: web app architecture, design, data, label, deployment, and code rules
- `dcr-tag-70x20/`: separate card lookup and label-generation toolkit; follow its `AGENTS.md`
- `incoming/`: temporary landing area for files that have not been classified
- `archive/source-packages/`: retained original bundles

See [architecture](docs/ARCHITECTURE.md), [design system](docs/DESIGN-SYSTEM.md), [data model](docs/DATA-MODEL.md), [label specification](docs/LABEL-SPEC.md), [code rules](docs/CODE-RULES.md), and [deployment notes](docs/DEPLOYMENT.md).
