# Design System - RED + WHITE ONLY

## Colors (only these)
- --dcr-red: #C8102E
- --dcr-red-dark: #9B0B22
- --dcr-red-light: #FFE8EB
- --dcr-white: #FFFFFF
- --dcr-black: #111111
- --dcr-gray: #6B7280
- --dcr-border: #E5E7EB

No dark blue background. No green/yellow/blue buttons.

## Logo
- Use the approved transparent DCR vector mark: public/assets/logo/dcr-mark.svg.
- The mark is extracted from the editable vector logo already embedded in the approved label master; preserve its paths and colors. The original composite PNG remains as a source reference.
- Never invent a new logo. Never use full 70x20 label on Home page.
- Logo on header left, small. Logo on label only in Label page.

## Typography
- Use locally hosted Inter for Latin text and Noto Sans Thai for Thai glyphs through the shared `--font-sans` token.
- Use regular and medium weights for body text and semibold headings and controls. Do not change the typography inside the approved printed label master.

## Layout
- Desktop: Sticky white header, DCR mark left, primary navigation right, content centered.
- Mobile: Compact header with an accessible expandable navigation menu.
- Home: Split hero with a short collection message, one certificate search field and Search button, and a static DCR card illustration.
- Keep search as the only call-to-action in the Home content. Do not show featured-card buttons or extra promotional sections there.
- Use the Mochi Space layout as a structural reference; retain DCR colors, logo, and locally hosted typography.

## Card display on Home
Home is focused on certificate lookup and does not show collection cards or prices. In other card summaries, show only image, name, set, grade badge (red), and certificate number. No large barcode or QR code.
