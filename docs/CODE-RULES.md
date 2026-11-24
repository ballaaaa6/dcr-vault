# Code Rules - Anti Bloat

1. No new colors. Add to tokens.css first.
2. No CSS in JS files. All styles in src/styles/.
3. No duplicate component. Reuse from src/components/.
4. One function = one job, max 50 lines.
5. One file max 300 lines, split if larger.
6. English only for file names (kebab-case), variables (camelCase), comments.
7. Never hardcode passwords or ship demo credentials. Use a server-verified identity provider and secure session cookies.
8. Full label only in Label page / Print page, never on Home.
9. No realtime price. Price only in Vault Card Detail.
10. Update CHANGELOG.md on every change.
11. No new library without reason in ARCHITECTURE.md.
12. Test before zip: login works, search works, vault works, label print aligns.

13. All instructions and prompts sent to Gemini must always be written in English.

14. Standard pages must use the shared footer layout and alignment in src/styles/layout.css; new pages inherit it by default.

15. Use the shared dropdown in src/components/dropdown.js and src/styles/dropdown.css for new single-choice dropdowns; supply the labels and options for each use.

16. For inline single-value editing, use the shared component in src/components/inline-edit.js and src/styles/inline-edit.css. Call inlineEdit with a unique id, label, value, and optional displayValue, maxLength, required, displayTag (span or h2), and inputType (text, textarea, or date); call initializeInlineEdit on its [data-inline-edit] row with getValue and async save callbacks. The save callback persists the value and getValue returns the current saved value. Supply formatValue to format saved values or empty placeholders. For an edit button without the inline editor, use editIconButton from the same module with a unique id, label, and controls id.

17. Use the shared date picker in src/components/date-picker.js and src/styles/date-picker.css for calendar selection. For inline date edits, use inputType date in the shared inline editor; its calendar icon, Save/Cancel layout, and automatic popup direction are reusable across the app.

18. For dialogs with two primary choices, use the shared two-choice-dialog, two-choice-description, and two-choice-actions classes from src/styles/confirmation-dialog.css: left-align the heading and center the description and buttons.

19. Every new or materially redesigned page must register a page-specific loading skeleton in src/components/page-skeleton.js, matching its main layout and responsive breakpoints. Reuse the shared skeleton styles and primitives in src/styles/page-skeleton.css; preserve the loading status for assistive technology. For loading sections within a rendered page, use the same skeleton styles and remove placeholders on success or failure. Update the skeleton whenever the page layout changes.

20. Use the shared `showToast(message, type)` from src/components/toast.js for toast notifications throughout the app. Choose `success`, `warning`, or `error` for the outcome; the component handles stacking, dismissal, and timing. Give related updates the same `key` and set `pending: true` while an operation is in progress.

21. Text inputs and textareas use the shared cursor behavior initialized in src/utils/text-cursor.js; keep new text controls compatible with it.

22. Scrollable containers with buttons must leave room for button shadows, hover movement, and focus outlines. Use the shared `button-safe-scroll` class from src/styles/buttons.css when the container needs this clearance, and verify that surrounding layout and scrolling remain usable.
