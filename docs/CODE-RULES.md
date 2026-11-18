# Code Rules - Anti Bloat

1. No new colors. Add to tokens.css first.
2. No CSS in JS files. All styles in src/styles/.
3. No duplicate component. Reuse from src/components/.
4. One function = one job, max 50 lines.
5. One file max 300 lines, split if larger.
6. English only for file names (kebab-case), variables (camelCase), comments.
7. No hardcoded password. Use env / auth.js constant marked TEMP.
8. Full label only in Label page / Print page, never on Home.
9. No realtime price. Price only in Vault Card Detail.
10. Update CHANGELOG.md on every change.
11. No new library without reason in ARCHITECTURE.md.
12. Test before zip: login works, search works, vault works, label print aligns.
