# Changelog
## Logo and typography refresh - 2026-11-18
- Added a transparent SVG DCR mark extracted from the approved label artwork and switched the site logo placements to it.
- Self-hosted Inter and Noto Sans Thai variable fonts and standardized shared interface typography while keeping the printed label master unchanged.

## Asset loading fix - 2026-11-18
- Corrected DCR logo and shield URLs to use Vite's public asset paths so they load on Cloudflare Pages.

## Workspace organization - 2026-11-18
- Moved the DCR Card Vault app to the workspace root and grouped its documentation under docs/.
- Added the DCR label toolkit under dcr-tag-70x20/, retained its source bundle under archive/source-packages/, and added workspace file-placement rules.
- Documented that the current static app keeps data per browser and that its demo login is not production access control.
- Added the project rule to commit and push future project changes to GitHub origin.

## 1.0.0 - 2026-11-18
- Initial zip: Home, Search, Vault, Label, Login admin/admin1234, Verify, Red-White theme, real DCR logo, 3D hover effects, print A4 40-up.
