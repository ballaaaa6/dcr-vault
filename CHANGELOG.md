# Changelog

## 2026-11-19

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
