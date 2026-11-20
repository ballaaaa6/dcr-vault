# Changelog
## OCR-first production rollout - 2026-11-20
- Installed and enabled the OCR service on the Ubuntu ARM64 Oracle VM with the pinned PaddleOCR runtime and the private 42,599-card catalog.
- Added the HTTPS OCR proxy while preserving the existing media-store route and stored the shared token in Oracle's protected environment file and the Cloudflare Pages production secret.
- Verified the OCR health endpoint reports its catalog ready and rejects unauthenticated requests.

## Metadata-first card identification - 2026-11-20
- Expanded the compact catalog index with the printed-card metadata used by the documented identification workflow, including HP, illustrator, stage, types, attacks, weaknesses, and set card counts.
- Replaced fuzzy name-first English suggestions with exact source-language card lookup followed by metadata corroboration against English catalog records.
- Auto-filled only a unique high-confidence match, kept ambiguous credible matches in the picker, and preserved the printed source collector number.
- Added exact source-card art thumbnails, hover previews, match evidence, and a same-card CDN fallback when the image proxy cannot load the thumbnail.
- Expanded card reading to capture metadata used to confirm a match.

## Card identification reliability - 2026-11-20
- Kept printed card fields as the required AI response and made English equivalents optional to reduce response-format pressure while preserving English catalog matching.
- Separated image-reading failures from catalog-loading failures in the match dialog.
- Added privacy-safe Worker diagnostics for empty or unparseable AI responses; logs include response shape and recognized field names, never card text or image data.

## English card intake and match picker - 2026-11-19
- Moved image-reading matches into a centered modal with compact card previews and larger hover previews.
- Resolved localized image matches to English catalog names and sets, and made rarity and grade selectable dropdowns.
- Added English-equivalent reading fields for catalog matching while keeping selected and displayed names in English.
- Prevented non-Latin card names or set names from being saved or printed on labels.
- Aligned Add Card form fields and documented the English label-text flow.

## Multi-user sign-in and private storage - 2026-11-19
- Added Google self-registration, server-verified sessions, owner-scoped D1 storage, and a responsive DCR login screen.
- Added an explicit selected-card import from legacy browser storage without uploading photos or removing the local copy.
- Updated production deployment to apply D1 migrations and wait for required Google and Cloudflare configuration.

## Card vault UX refresh - 2026-11-19
- Reworked the shared navigation and responsive menu around the DCR Card Vault identity.
- Replaced the Home featured-card and promotion sections with a focused certificate search and DCR card illustration.
- Updated certificate lookup result states, clarified local record behavior, styled the core app pages, and made Vault filters work.

## Logo and typography refresh - 2026-11-18
- Added a transparent SVG DCR mark extracted from the approved label artwork and switched the site logo placements to it.
- Self-hosted Inter and Noto Sans Thai variable fonts and standardized shared interface typography while keeping the printed label master unchanged.

## Asset loading fix - 2026-11-18
- Corrected DCR logo and shield URLs to use Vite's public asset paths so they load on Cloudflare Pages.

## Workspace organization - 2026-11-18
- Moved the DCR Card Vault app to the workspace root and grouped its documentation under docs/.
- Added the DCR label toolkit under dcr-tag-70x20/, retained its source bundle under archive/source-packages/, and added workspace file-placement rules.
- Documented that the earlier static app kept data per browser and that its temporary demo login was not production access control.
- Added the project rule to commit and push future project changes to GitHub origin.

## 1.0.0 - 2026-11-18
- Initial zip: Home, Search, Vault, Label, temporary demo Login, Verify, Red-White theme, real DCR logo, 3D hover effects, print A4 40-up.
