# Changelog

## 2026-11-19

- Upgrade Vite to 8.3.8, which includes the upstream security fixes, and refresh the lockfile; the Pages workflow already selects Node.js 22 for the supported runtime.
- Render label previews and A4 duplex print sheets from the approved 70 × 20 mm SVG masters, with live field updates and generated DCR test QR/Code 128 codes.
- Align the A4 sheet guide with the approved 10 × 4 portrait layout and long-edge duplex instructions.
- Replace demo credentials with Google Identity Services and automatic self-registration, server-verified sessions, and owner-scoped D1 card APIs.
- Redesign sign-in as a responsive DCR split layout and remove the global site navigation from the login screen.
- Add an explicit legacy-data import choice; retain the browser copy and omit card images.
- Add the initial D1 migration and gate automatic Pages publishing until Google OAuth and D1 deployment settings are present.
- Document account data, privacy boundaries, and Cloudflare/Google setup.
- Clarify that External/Testing sign-in can allow all Google accounts with only basic identity scopes; verified Published branding still requires domain ownership.
- Fix Pages deployment to use the root Wrangler configuration without the unsupported custom config path option.
- Fix the logout Function to import the session cookie helper from the sessions module.
- Set the Pages compatibility date to the latest date accepted by Cloudflare's UTC deployment runtime.

## 2026-11-19

- Add a GitHub Actions workflow to build and deploy the site to the existing Cloudflare Pages project.
- Document the production deployment flow and required GitHub repository secrets.
- Document the Cloudflare Pages deployment token rotation date.
