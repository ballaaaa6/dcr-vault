# Workspace rules

## Project layout

- The workspace root is the DCR Card Vault web app. Keep `index.html`, `package.json`, `package-lock.json`, and `vite.config.js` here so the app runs from the root.
- Put browser application code in `src/`: pages in `src/pages/`, reusable UI in `src/components/`, data and persistence in `src/store/`, helpers in `src/utils/`, and styles in `src/styles/`.
- Put files served as static assets in `public/`. Keep source code out of `public/`.
- Put long-form web-app documentation in `docs/`. Keep the entry-point `README.md` and this `AGENTS.md` at the root. Update relative links when moving documentation.
- Keep all label design, lookup, catalog, reference images, scripts, and label workflow outputs under `dcr-tag-70x20/`. Follow its nested `AGENTS.md` for card identification and label generation. Do not scatter toolkit files through the web app folders.
- Use `incoming/` only as a temporary landing area for new files that have not been classified. Inspect each file, move it to the correct project folder, and remove it from `incoming/` after processing. Do not use the workspace root as a general download or extraction folder.
- Keep retained original bundles in `archive/source-packages/`. Before extracting a new bundle, inspect its paths and check for collisions. Never overwrite existing project files without reviewing them first.
- Put new web features in the existing `src/` structure. Add a new top-level folder only when it represents a distinct, documented subsystem.

## Generated and private files

- Do not commit `node_modules/`, `dist/`, Python caches, logs, local environment files, or generated label job outputs.
- Do not put credentials, private card scans, or personal collection exports in public app assets.
- Preserve label masters, curated reference data, and source artwork. Generate each label job into a new output folder; follow the toolkit instructions before editing or replacing any master.

## Local development server lifecycle

- Before starting a local development server, inspect existing listeners and process command lines for this repository.
- Reuse a healthy server already running for this repository instead of starting a second copy.
- Use the configured port in `vite.config.js` (5173). Do not rely on automatic fallback ports. If it is occupied by an unrelated or unhealthy process, report it or stop only the exact project process when authorized.
- Track every long-running process started during a task and stop its process tree after verification unless the user explicitly asks to keep it running.
- Do not terminate Codex-owned `mcp/server.mjs`, `node_repl`, or processes under `OpenAI\Codex\runtimes` during project cleanup.
- Before completing a task that started local tooling, check for duplicate Vite, Wrangler, workerd, Next.js, or similar development processes and clean up only the processes created for that task.

- Follow docs/CODE-RULES.md for implementation conventions and changelog updates.

## Finish work before publishing

- Complete the full scope of an authorized code change, including its dependent changes and required documentation, before committing or pushing. Do not commit or push a partial implementation as if the task were finished.
- Review the final diff against the user's request and resolve known gaps before publishing. Follow the user's testing instructions; do not add testing requirements that the user has explicitly excluded.
- If work cannot be completed, clearly report what remains and why. Leave unfinished changes local unless the user explicitly asks for a partial commit or push.
- Once the change is complete, commit the finished changes and push them to the configured GitHub `origin` as part of the task. Do not publish secrets, private collection data, generated outputs, or local dependencies. If a push cannot complete, report the blocker and leave the commit ready to push.

## Add Card layout freeze

- Keep every part of the Add Card page layout fixed unless the user explicitly requests further changes to it.

## Page headings

- Do not add a red eyebrow or introductory text line above the main heading on new pages.
