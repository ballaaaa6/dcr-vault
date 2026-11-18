# Architecture

## Phases
- Phase 1 Local: Static HTML/CSS/JS, IndexedDB via localStorage fallback, sessionStorage auth.
- Phase 2 GitHub: Push code only, no secrets, no large photos.
- Phase 3 Cloudflare: Pages for frontend, D1 for card data, Workers AI for identification assist.
- Phase 4 Oracle: Object Storage for card images, D1 stores URLs.

## Data flow
UI -> router.js -> pages/*.js -> store/cards.js -> localStorage (dcr-cards-v1) -> render
Auth -> auth.js -> sessionStorage (dcr-session)

## Rules
- One page = one file in src/pages/
- One component = one file in src/components/
- One style topic = one file in src/styles/
- No framework, no heavy lib.
