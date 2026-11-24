# Changelog

## 2026-11-24 - Adjust share tooltip colors
- Invert the share tooltips and restore the copy-link button hover colors.

## 2026-11-24 - Refine certificate sharing icons
- Use outlined sharing icons with platform-colored hover states and animated tooltips.

## 2026-11-24 - Update certificate share menu
- Replace the certificate share dialog with an app-themed expandable share menu, retaining its existing destinations.

## 2026-11-24 - Refine certificate share buttons
- Add app-styled share tooltips, authentic platform logos, and a red copy-link hover state.

## 2026-11-24 - Unify dialog close controls
- Use the shared red corner close control and compact labeled sharing icons in the certificate dialog.

## 2026-11-24 - Update certificate action icons
- Use matching regular-weight download and share icons on certificate actions.

## 2026-11-24 - Add certificate sharing destinations
- Offer LINE, Facebook, X, and supported device sharing from the certificate share dialog.

## 2026-11-24 - Refine certificate sharing
- Tighten certificate action spacing and show sharing details in the shared app dialog before copying or sharing the link.

## 2026-11-24 - Save and share certificates
- Add PNG export of the public certificate details and a direct sharing action.

## 2026-11-24 - Refine Cert dice motion
- Keep the dice still at rest, rock them on hover, and spin once on activation.

## 2026-11-24 - Animate the Cert dice button
- Use the with icons dice design and motion on the Cert generator button, following the existing button color and reduced-motion preference.

## 2026-11-24 - Improve content-driven layouts
- Align usage date filters and reserve button clearance, constrain calendar size, allow form rows and card content to grow without overlap, and reserve inline editing status space.

## 2026-11-24 - Unify empty-field guidance
- Apply one shared placeholder color to empty inputs, choices, dates, and profile guidance across the app.

## 2026-11-24 - Soften location dialog background
- Reduce the koi illustration to 20% visibility in location management dialogs.

## 2026-11-24 - Soften private vault placeholders
- Match empty acquisition and date prompts to the other placeholder text.

## 2026-11-24 - Reorder locations
- Drag or use the keyboard to reorder locations, with a red drop indicator and saved account order.

## 2026-11-24 - Add location management background
- Use a softened koi illustration across all location management views, scaled and anchored to the bottom right.

## 2026-11-24 - Share content-sized dialog spacing
- Reserve button clearance once in content dialogs and hide empty status messages, including in location management.

## 2026-11-24 - Fit the location list to its contents
- Show up to four complete locations and scroll additional locations within the list.

## 2026-11-24 - Balance manage cards footer spacing
- Remove duplicated bottom padding while retaining clearance for button effects.

## 2026-11-24 - Keep scrolling inside the card list
- Fit the Manage cards dialog around its contents and confine scrolling to its card list.

## 2026-11-24 - Fit five cards in vault pickers
- Size both card picker lists to show five complete rows on opening while keeping their actions close below.

## 2026-11-24 - Apply shared button clearance across the app
- Reserve shared space for button effects in existing dialogs, scrolling content, and the sign-in footer; document the requirement for future controls.

## 2026-11-24 - Share popup placement
- Reuse viewport-aware dropdown placement for location, card, and account menus, flipping upward when space below is limited.

## 2026-11-24 - Preserve button visibility in scrollable areas
- Provide shared clearance for button effects and apply it to the location dialog so its buttons are not clipped.

## 2026-11-24 - Refine vault label picker controls
- Use the location dialog close button and right-align Add selected in the vault label picker.

## 2026-11-24 - Use Lucide settings icon
- Replace the location menu gear symbol with the Lucide Settings icon.

## 2026-11-24 - Shorten location menu action
- Rename the location management action to Manage and add a gear symbol.

## 2026-11-24 - Reposition location dialog controls
- Place the add button beside the heading and the close button on the upper-right corner.

## 2026-11-24 - Allow custom card games
- Keep and save typed Card game values when they are not in the suggestions.

## 2026-11-24 - Refine location dialog controls
- Shorten the add button label and move the close button to the upper-left corner.

## 2026-11-24 - Resume editing at the end
- Place the cursor at the end when entering text fields, including editable catalog selections.

## 2026-11-24 - Refine location choices
- Animate the selection reveal, outline choices in red, and simplify the position labels.

## 2026-11-24 - Style location choices
- Give location deletion radio choices a red gradient inspired by the selected Uiverse design.

## 2026-11-24 - Keep storage location suggestions open
- Limit Add Card outside-click handling to its own page so Vault location suggestions remain available while editing.

## 2026-11-24 - Private storage locations
- Add private storage locations and positions, location filtering, and shared location management.

## 2026-11-24 - Show complete images at once
- Keep the shared image loading effect visible until the image is fully loaded and decoded, then show it immediately.

## 2026-11-24 - Image loading glow
- Add a medium red outer glow around image loading placeholders.

## 2026-11-24 - Shared image loading effect
- Add a red and white animated placeholder for loading images while preserving existing image prefetching and fallbacks.

## 2026-11-23 - Clear card game with photo reading
- Clear the selected card game along with the identified details when the front photo is removed or replaced, unless it was edited after the reading.

## 2026-11-23 - Rotate Gemini keys for every attempt
- Advance the shared key rotation for every Gemini call, including retries and failovers, and limit each request to the configured key count.


## 2026-11-23 - Gemini usage and shared key rotation
- Rotate configured Gemini keys across requests using an atomic D1 counter, and record each attempt and available token usage without storing keys.
- Add an administrator-only usage page with date filters and key-level totals.


## 2026-11-23 - Compact condition menu

- Reduce condition menu row spacing and limit its height while keeping automatic placement and scrolling.

## 2026-11-23 - Keep dropdown menus visible

- Open shared dropdowns toward available viewport space and scroll long menus; enable automatic placement for searchable card fields.

## 2026-11-23 - Restore filled field styling

- Restore gray backgrounds for filled Add Card fields and use the shared dropdown for condition selection.

## 2026-11-23 - Identify card game in Add Card

- Start Card game empty, allow searchable selection, and fill Pokémon TCG from a supported image reading.

## 2026-11-23 - Match card suggestion menus

- Reuse the app's shared dropdown styles for Add Card suggestions, including typography, spacing, and selected marks.

## 2026-11-23 - Refine Add Card selectors

- Add a clear button to editable card fields and use a paired up/down dropdown indicator with rounded controls.

## 2026-11-23 - Use Creatable card inputs

- Use React Select's Creatable control for Add Card catalog fields while retaining examples, manual entry, filtering, and image-reading integration.

## 2026-11-23 - Connect Pokémon intake fields

- Arrange Add Card details in seven rows and select Pokémon as the card game.
- Offer editable, related catalog suggestions while retaining manually entered values and warning when no matching record is found.
- Derive label language and store the illustrator behind the scenes; protect chosen game and language during Gemini identification.
- Reduce the opacity of example text in Add Card fields.

## 2026-11-23 - Improve profile description editing space

- Size profile description fields relative to their text so two lines fit above the character count.

## 2026-11-23 - Limit profile descriptions

- Show a live character count inside the Short bio and Collection goal fields and limit each to 200 characters.

## 2026-11-23 - Update ongoing toast notifications

- Keep related operation updates in the same toast, hold progress messages until completion, and fade results over six seconds.

## 2026-11-23 - Adjust selected vault card artwork

- Keep card text unchanged when selected and increase selected background artwork opacity to 80%.

## 2026-11-23 - Refine selected vault cards

- Show the selected card's background artwork at 60% opacity instead of a red fill.

## 2026-11-23 - Continue adding cards

- Clear the Add Card form and show a success toast after saving, keeping the user on the page for the next card.

## 2026-11-23 - Keep profile photos consistent

- Prefer an uploaded full photo over a legacy Google thumbnail and require photo versions to be saved together.

- Keep the current Cert number while finding a new available number and show the result after checking.
- Show a color-coded ten-second progress bar on shared toast notifications.

## 2026-11-23 - Animate home shortcut borders

- Reveal the red outline from left to right when hovering or focusing a home shortcut.

## 2026-11-23 - Add shared toast notifications

- Add reusable success, warning, and error toasts with a shared bottom-right stack and use them for Add Card notifications.

## 2026-11-23 - Unify intake notification timing

- Fade all Add Card notification types after six seconds and clear them after ten seconds.

## 2026-11-23 - Refine card intake notifications

- Remove the unverified-record notification, use neutral card-reading wording, and stack intake notifications from the bottom.

- Reduce the Recommended badge size to keep the plan name prominent.

## 2026-11-23 - Rename Add Card route

- Move the Add Card page to /archive and remove the /register route.

- Increased spacing above billing plans and highlighted the Pro plan with a centered Recommended badge.

## 2026-11-23 - Use current link formats

- Remove support for legacy hash routes and certificate query links; certificate records use /cert/ paths.

## 2026-11-23 - Improve billing price hierarchy

- Align plan prices, emphasize the featured price, and separate plan benefits from pricing.

## 2026-11-23 - Describe the collection plans

- Add a short collection-focused description to the billing page heading.

## 2026-11-23 - Add mouse and touch photo zoom

- Zoom profile photos with the mouse wheel, pinch gestures, or keyboard while positioning them.

## 2026-11-23 - Compact billing plan preview

- Shorten the billing heading and tighten the plan layout to fit on a desktop screen.

## 2026-11-23 - Restore profile photo positioning

- Restore draggable circular photo selection, add zoom, and retain a separate full image for viewing.

## 2026-11-23 - Fit card viewers on screen

- Fit My Vault previews and certificate images within the viewport without scrolling.

## 2026-11-23 - Preserve full profile photos

- Keep the entire uploaded photo and fit it inside the profile frame and preview.

## 2026-11-23 - Add billing page preview

- Add a three-plan billing layout with example content and inactive controls, accessible from the account menu.

## 2026-11-23 - Restore falling profile petals

- Fix the clipping region so sakura petals appear inside both profile cards, and soften the shared background to 30% opacity.

## 2026-11-23 - Add a connected profile landscape

- Add a shared right-aligned sakura landscape and falling petals across the profile cards, clipped to each card.

## 2026-11-23 - Make loading skeletons a shared page convention

- Show loading placeholders for Privacy Policy and Google sign-in, and define a shared skeleton registry and convention for future pages.

## 2026-11-23 - Match loading skeletons to each page

- Give Home, Add Card, My Vault, Labels, Profile, certificate verification, and import their own responsive loading layouts.

## 2026-11-23 - Show page loading skeletons

- Show responsive skeleton placeholders while the main pages load their session and data.

## 2026-11-23 - Confirm account logout

- Improve logout hover text contrast and ask for confirmation before signing out.

## 2026-11-23 - Match date field and calendar widths

- Keep inline date fields aligned with the calendar popup width.

## 2026-11-23 - Standardize two-choice dialogs

- Center descriptions and buttons in two-choice dialogs while keeping headings left aligned.
- Use an app dialog when confirming whether to discard unsaved vault edits.

## 2026-11-23 - Show profile membership summary

- Show the number of cards and membership month in the profile identity block.

## 2026-11-23 - Align inline calendar editing

- Keep the date editor and its actions aligned without expanding the profile row.
- Share the calendar icon and choose the popup direction based on available space.

## 2026-11-23 - Edit personal details individually

- Give each profile detail its own inline editor and use a calendar icon for the collecting date.
- Swap the heading and answer colors in Personal details.

## 2026-11-23 - Center photo removal confirmation

- Center the message in the profile photo removal dialog.

## 2026-11-23 - Even profile identity spacing

- Use consistent spacing between the profile name, email, and photo guidance.

## 2026-11-23 - Shorten photo removal message

- Keep the profile photo removal confirmation concise.

## 2026-11-23 - Hide profile photo removal control

- Hide the removal control when the pointer leaves the avatar while preserving keyboard access, and center the confirmation buttons.

## 2026-11-23 - Share inline editing controls

- Make the profile name edit icon and Save/Cancel editor reusable across the app.

## 2026-11-23 - Restore profile photo cropping

- Open the photo crop editor after choosing an image instead of selecting the removal confirmation dialog.

## 2026-11-23 - Update profile name edit icon

- Use a square pen icon that turns red on hover.

## 2026-11-23 - Fix profile photo hover size

- Keep the add-photo overlay aligned to the circular profile avatar.

## 2026-11-23 - Adjust profile name editor spacing

- Match the visible spacing around the Save button when the name field is focused.

## 2026-11-23 - Simplify profile photo controls

- Add hover controls for uploading and removing profile photos, with an in-app removal confirmation.

## 2026-11-23 - Keep profile name editing on one line

- Keep name editing controls in the name row and limit display names to 20 characters, including imported account names.

## 2026-11-23 - Remove profile account block

- Remove the Account block from My profile; log out remains available in the account menu.

## 2026-11-23 - Verify deployments before delivery

- Require local deployment checks before pushing and confirmation that the pushed commit deployed successfully before reporting work complete.

## 2026-11-23 - Expand the account menu

- Add grouped account menu items and icons, with Profile and Log out connected to their existing actions.
- Reuse and document the shared half-strength red hover color.

## 2026-11-23 - Sort vault cards by Cert number

- Add ascending and descending Cert number sorting in My Vault and the label picker.

## 2026-11-23 - Share the dropdown component

- Extract the vault sorting dropdown into a reusable component and document its use for future dropdowns.

## 2026-11-23 - Refine vault sort controls

- Add light red up and down chevrons and round the sort controls in My Vault and the label picker.

## 2026-11-23 - Fix vault sort deployment test

- Handle vault sort changes through the shared dropdown event listener.

## 2026-11-23 - Restyle vault sorting menus

- Use matching custom dropdown menus in My Vault and the label picker, with a softer red hover state.

## 2026-11-23 - Sort cards in the label picker

- Add the My Vault sorting dropdown beside Select all, preserving card selections when sorting.

## 2026-11-23 - Further soften label backgrounds

- Reduce the label panel background images to 15% opacity.

## 2026-11-23 - Use scrollbars throughout the app

- Apply the slim red scrollbar style to all scrollable pages and panels.

## 2026-11-23 - Show label picker scrollbars

- Show the red scrollbar in the card selection list and label dialogs when their content overflows.

## 2026-11-23 - Soften label backgrounds

- Reduce the label panel background images to 30% opacity.

## 2026-11-23 - Align sticky label panels

- Align the sheet list heading with the certificate panel while scrolling on desktop.

## 2026-11-23 - Style page scrollbar

- Add a slim red page scrollbar and restore its visibility on the Labels page.

## 2026-11-23 - Add label page backgrounds

- Add faded mountain backgrounds to the certificate entry, sheet list, and vault selection panels.

## 2026-11-23 - Adjust vault selection heading spacing

- Bring the description closer to the heading in the label vault selection dialog.

## 2026-11-23 - Export vector label sheets

- Assemble front and back labels as SVG artwork and export vector A4 PDF pages without rasterizing the sheet.
- Center 0.10 mm cut guides on the label boundaries and leave a 2 mm clearance from the label grid.

## 2026-11-23 - Show back to top on scrollable pages

- Reuse the back-to-top button on the privacy policy and show it whenever a page has been scrolled down.

## 2026-11-23 - Strengthen copyright glow

- Use white copyright text with a stronger black glow on the login and privacy policy pages.

## 2026-11-23 - Align privacy return button

- Align Back to Login with the login page's Back to Home button.

## 2026-11-23 - Improve privacy copyright readability

- Use black text with a white glow for the privacy policy copyright.

## 2026-11-23 - Improve login copyright readability

- Use black text with a white glow for the login page copyright.

## 2026-11-23 - Rename certificate heading

- Change the public certificate page heading to Certificate Verification.

## 2026-11-23 - Restore Labels after deployments

- Load the label renderer with the application and recover once from stale deployment assets.
- Keep the error page usable and remove its red introductory line.
- Require fresh HTML and document the heading preference for new pages.

## 2026-11-23 - Raise page headings

- Move the My Vault, Labels, and My profile headings closer to the top of their pages.

## 2026-11-23 - Simplify certificate lookup heading

- Remove the DCR Card Vault label above Certificate lookup.

## 2026-11-23 - Simplify profile heading

- Remove the Your Account label above My profile.

## 2026-11-23 - Set short Vault row text colors

- Use black text with a white glow on unselected short rows and white text with a dark glow on the selected row.

## 2026-11-23 - Soften short Vault backgrounds

- Use 30% artwork opacity instead of darkening the image, preserving its colors and existing fade.

## 2026-11-23 - Improve short Vault row readability

- Add contrasting text glow to short card rows in the three-panel view.

## 2026-11-23 - Dim short Vault backgrounds

- Set short-row artwork brightness to 30% while keeping its existing fade.

## 2026-11-23 - Refresh short Vault backgrounds

- Replace the 18 short-row illustrations and fade them in from the left through 70% of the row on both white and selected red backgrounds.

## 2026-11-23 - Preserve certificate background proportions

- Scale certificate artwork proportionally from the right and reduce its opacity to 40%.

## 2026-11-23 - Link Vault photos to certificates

- Add a centered View Cert button beneath Preview on selected Vault cards.

## 2026-11-23 - Improve card image loading

- Generate small and medium card photos on demand while retaining originals for zoom and download.
- Revalidate saved card images and preload nearby Vault photos with bounded concurrency.

## 2026-11-23 - Add certificate backgrounds

- Show a paper-art certificate background matched to the card classification, with an unknown fallback.

## 2026-11-23 - Speed up selected Vault artwork

- Compress selected-card artwork and preload only the classifications present in the vault.

## 2026-11-23 - Restore selected Vault card colors

- Restore the red selected card background and white text while retaining transparent classification artwork.

## 2026-11-23 - Add card classification artwork to Vault

- Display classification backgrounds in Vault lists and selected card panels, with an unknown fallback for unclassified cards.

## 2026-11-23 - Save and review card classification

- Allow card categories and types to be reviewed, edited and saved with vault cards; leave existing cards unclassified.

## 2026-11-23 - Record card categories in Gemini readings

- Request structured Pokémon, Trainer, and Energy categories and record the returned Trainer and Energy details in identification logs.

## 2026-11-23 - Retain Pokémon types in identification logs

- Record Gemini's raw and normalized Pokémon types in the existing identification log.

## 2026-11-22 - Add Card mountain backgrounds

- Add the paired red mountain backgrounds with softened imagery and readable text surfaces.

## 2026-11-22 - Toggle vault card details

- Allow the selected card to be deselected, expanding the vault list until another card is selected.

## 2026-11-22 - Restore login copyright alignment

- Keep the copyright in its original position while the footer buttons remain right-aligned.

## 2026-11-22 - Align login footer buttons

- Align the Privacy Policy and Back to Home buttons to the right edge of the viewport.

## 2026-11-22 - Update privacy button color

- Use a red background and white text for the Privacy Policy button.

## 2026-11-22 - Style privacy navigation

- Match the Privacy Policy button to the outlined Back to Home button.

## 2026-11-22 - Adjust return button labels

- Use title case for Back to Login and Back to Home.

## 2026-11-22 - Style return navigation

- Give the login and privacy return links red outlined buttons and capitalize BACK TO HOME.

## 2026-11-22 - Remove page introductory labels

- Remove the introductory labels from Home, Add Card, My Vault, and Labels.

## 2026-11-22 - Align privacy page footer

- Match the login footer alignment and copyright text glow on the privacy page.

## 2026-11-22 - Simplify privacy navigation

- Remove the header navigation and keep a single return to login link in the privacy page footer.

## 2026-11-22 - Reposition privacy policy content

- Remove the table of contents, place the policy beside the sakura landscape, and add a return to login button.

## 2026-11-22 - Center login text

- Center the sign-in heading and description with the Google button.

## 2026-11-22 - Refine login controls and footer

- Enlarge Google sign-in and move the privacy link beside Back to Home.
- Keep the account note compact and improve copyright contrast over the background.

## 2026-11-22 - Improve the privacy policy page

- Add the animated sakura landscape and reorganize the privacy policy for easier reading.

## 2026-11-22 - Enlarge login content

- Enlarge the sign-in content and align its footer with the rest of the site.

## 2026-11-22 - Simplify the login page

- Keep the sign-in page focused on Google sign-in, account creation, and the privacy policy.

## 2026-11-22 - Animate the login landscape

- Add the selected sakura landscape with gently moving branches and drifting petals to the sign-in page.

## 2026-11-22 - Keep Add Card fields steady

- Show Cert number validation without shifting the card details form.

## 2026-11-22 - Update home hero label

- Show Secret Rare on the Crimson Peak illustration.

## 2026-11-22 - Update home hero artwork

- Replace the home illustration with the selected Crimson Peak artwork and its fictional DCR label.

## 2026-11-22 - Organize application code

- Remove unused application helpers and legacy reader code; separate Add Card markup and page styles without changing the layout.
- Correct catalog and application documentation and ignore local private key files.

## 2026-11-22 - Keep selected vault card visible

- Keep the selected card details and photo together below the header while scrolling the vault list on desktop.

## 2026-11-22 - Translate rocket button label

- Display TOP on the original rocket artwork.

## 2026-11-22 - Add rocket back-to-top button

- Add the TipsBlocks Rocket Return button to scroll back to the top of long pages.

## 2026-11-22 - Keep label controls visible

- Keep the certificate form and label list heading visible while scrolling through long lists.

## 2026-11-22 - Show collecting duration

- Display the number of days since the collecting start date on the profile.

## 2026-11-22 - Flip profile edit icon

- Flip the pencil icon beside the profile name horizontally.

## 2026-11-22 - Resize profile calendar

- Keep the collecting date calendar compact while retaining the existing date field width.

## 2026-11-22 - Add collector profile details and shared footer alignment

- Add collecting start date and collection goal to personal details.
- Use the shared footer alignment for standard pages, including profile.

## 2026-11-22 - Personalize collector profiles

- Move display name editing beside the profile name and add editable favorite series and short bio fields.
- Add a database migration for persistent personal details.

## 2026-11-22 - Streamline profile photo selection
- Open the file picker directly, then allow dragging the selected photo within the circular crop guide.

Times are commit times in Bangkok time (UTC+7); older entries without a time have no matching commit record.

## 2026-11-22 - Preserve full profile photos
- Keep the entire uploaded photo and its proportions in the profile preview.

## 2026-11-22 - Fit profile photo preview to image
- Size the profile photo dialog to its image while keeping it within the screen.

## 2026-11-22 - Enlarge profile photo preview
- Show the profile photo centered in a nearly full-screen preview.

## 2026-11-22 - Make personal details read-only by default
- Show the display name as text until the profile edit button is selected.

## 2026-11-22 - Refine account profile
- Limit edited display names to 12 characters and open profile photos in a preview dialog.

## 2026-11-22 - Add account profile
- Add an account menu and private profile editing for display name and photo, preserving edits on Google sign-in.

## 2026-11-22 - Adjust vault price display
- Show the purchase amount before its currency in private vault details.

## 2026-11-22 - Refine vault date picker
- Replace native month and year menus with a white calendar and selectable year and month grids.

## 2026-11-22 - Refine label vault selection
- Use aligned heart selection controls and shade cards already added to the label sheets.

## 2026-11-22 - Improve label card selection
- Show front card photos in label rows and the vault picker, add a red remove icon, and support select all with selected-row shading.

## 2026-11-22 16:33 - Record changelog times and archive research
- Add available commit times to changelog entries and retain catalog research and source packages.

## 2026-11-22 16:30 - Improve vault acquisition date
- Rename Source to Acquisition and improve the date picker with month and year selection, a white theme, adaptive placement, and disabled future dates.

## 2026-11-22 16:23 - Default vault sorting
- Show cards by newest received date by default in My Vault.

## 2026-11-22 16:21 - Clarify completed card details
- Show an English language hint, shade filled intake fields, and focus the first invalid required field when adding a card.

## 2026-11-22 16:16 - Clarify anniversary set names
- Display and save the 25th and 30th Celebration set names consistently while retaining catalog set identities.

## 2026-11-22 16:11 - Reconcile Gemini readings with catalog
- Show Gemini readings first and apply differing catalog values for matched cards while preserving user edits and printed numbers.

## 2026-11-22 16:01 - Fade intake status messages
- Keep the intake status visible for six seconds, then fade it over four seconds; restart the timer for each message.

## 2026-11-22 15:58 - Standardize card label fields
- Derive card type and language labels from the identified game and language, and recognize equivalent promo set names.

## 2026-11-22 15:49 - Verify uncertain card readings
- Leave uncertain Gemini fields blank until corroborated by the catalog, add a verified Rayquaza-EX promo, and revalidate the catalog on reload.

## 2026-11-22 15:35 - Recover missing card details
- Fill the illustrator from Gemini and use corroborated catalog evidence to suggest missing intake details while preserving printed numbers and user edits.

## 2026-11-22 15:26 - Keep card intake stable after reading
- Show intake status messages without moving the card form or image fields.

## 2026-11-22 15:24 - Fit the add-card page
- Reduce image upload and form height on desktop to fit the intake page more comfortably within the screen.

## 2026-11-22 15:21 - Simplify card intake
- Remove the Notes field from the add-card form.

## 2026-11-22 15:19 - Clearer label text spacing
- Reserve a 2 mm gap between left and right label text, abbreviating long lines as needed.

## 2026-11-22 15:18 - Dismiss vault card options
- Close the vault card options menu when clicking elsewhere on the page.

## 2026-11-22 15:16 - Fit long label text
- Abbreviate words from the end of an overlong label line until it fits, while retaining the original card details.

## 2026-11-22 15:14 - Quick card deletion
- Move card deletion to the vault card options menu and keep the confirmation dialog.

## 2026-11-22 15:11 - Review label details from card readings
- Ask Gemini for card type, language label and series, allow review and editing, and save the fields for label printing.

## 2026-11-22 15:02 - Label card type and series
- Show card type and series in label details and print year, type, language and series using approved fit abbreviations.

## 2026-11-22 14:50 - Card year on labels
- Print the recorded card year and remove the separate year / series display and profile requirement.

## 2026-11-22 14:47 - Promotional card rarity
- Fill Promo for promotional card readings and record intake-form values in identification diagnostics.

## 2026-11-22 14:43 - Read-only label details
- Show the card year separately from the verified label year / series and make label details read-only.

## 2026-11-22 14:39 - Compact label workspace
- Arrange certificate entry and the sheet list in side-by-side columns on larger screens, with unobtrusive scrolling.

## 2026-11-22 14:36 - Label sheet workspace
- Add certificate range lookup and multi-select vault cards to a single-page label workspace, with optional previews and multi-sheet PDF download.

## 2026-11-22 14:25 - More prominent navigation logo
- Enlarge the DCR logo beside the full registry name.

## 2026-11-22 14:22 - Full registry name
- Show Distinguished Card Registry beside the navigation logo.

## 2026-11-22 14:19 - Clear search visibility
- Show search clear buttons only when their fields contain text.

## 2026-11-22 14:17 - Clear search
- Add clear buttons to vault and certificate searches, restoring vault cards and clearing certificate results immediately.

## 2026-11-22 14:12 - Vault test fixture
- Support date picker initialization in the vault selection test.

## 2026-11-22 14:10 - Vault sort filter width
- Left-align sort labels and size the filter to its longest option.

## 2026-11-22 14:09 - Received date calendar
- Add an English date picker matching the Flowbite-style calendar and the field width.

## 2026-11-22 14:05 - Vault sort text
- Fit and center the sort filter labels.

## 2026-11-22 14:01 - Private vault details and sorting
- Add purchase currency, source, seller and received date; preserve previous private details.
- Sort vault cards by name, purchase price grouped by currency, or received date.

## 2026-11-22 13:46 - Certificate search input
- Pad numeric vault certificate searches to eight digits and restrict home certificate input to numbers.

## 2026-11-22 13:23 - Vault empty search results
- Show the no-results message across the full vault layout and hide stale card details.

## 2026-11-22 13:19 - Vault search bar
- Place the status filter before a home-style search bar with a Search button.

## 2026-11-22 13:14 - Edit certificate numbers
- Allow vault owners to change a card's Cert number, with validation and global duplicate protection.

## 2026-11-22 13:03 - Vault detail views
- Switch between card and private details and edit each separately.

## 2026-11-22 12:56 - Vault photo hover controls
- Hide photo controls when the pointer leaves while preserving keyboard access.

## 2026-11-22 12:52 - Vault photo fit
- Fill the padded photo panel and keep the entire card image visible.

## 2026-11-22 12:52 - Vault photo panel sizing
- Keep the photo panel tied to the selected card details height, including shorter records.

## 2026-11-22 12:50 - Vault photo controls
- Reveal photo controls on hover and match the photo panel height to the details panel.

## 2026-11-22 12:47 - Vault card photo viewer
- Flip between card sides in the vault and preview, with certificate-style magnification.

## 2026-11-22 12:42 - Compact vault details
- Remove the redundant print link and reduce spacing between item information rows.

## 2026-11-22 12:39 - Vault page height
- Align the vault footer with Home and Add Card and scroll only when content exceeds the viewport.

## 2026-11-22 12:34 - Vault selection clarity
- Simplify the card details panel and highlight the selected card in red.

## 2026-11-22 12:30 - Card deletion confirmation
- Show a branded confirmation dialog before deleting a vault card.

## 2026-11-22 12:27 - Three-column vault
- Separate the card list, certificate details, and card photo into equal desktop columns.

## 2026-11-22 12:23 - Vault card selection
- Switch selected vault cards in place while keeping the vault URL unchanged.

## 2026-11-22 12:20 - Vault card management
- Show certificate information in a wider vault detail panel, with owner-only editing and card deletion that releases its certificate number.

## 2026-11-22 11:23 - Card photo preview sizing
- Fit the complete photo within the preview popup without a scrollbar.

## 2026-11-22 11:13 - Card photo preview
- Add a full-size popup preview for both selected card photos.

## 2026-11-22 11:10 - Card photo remove button
- Enlarge the remove button on front and back photo previews.

## 2026-11-22 11:08 - Card identification guidance
- Refresh the card identification guidance with a shorter, more inviting message.

## 2026-11-22 11:06 - Card intake screen space
- Expand the intake panels to fill available screen height and distribute the form rows evenly.

## 2026-11-22 11:02 - Home footer alignment
- Match the home footer position to the register page on desktop.

## 2026-11-22 11:00 - Notes field spacing
- Align the optional Notes field and preserve consistent spacing as it is resized.

## 2026-11-22 10:58 - Compact card intake
- Reduce desktop form spacing so the intake page and footer fit more comfortably on screen.

## 2026-11-22 10:57 - Browser tab icon
- Show the DCR logo in the browser tab.

## 2026-11-22 10:54 - Card intake details
- Expand card image previews and require core card details; add optional artist and private notes with Vault editing.

## 2026-11-22 10:48 - Certificate label codes
- Link each label QR to its public certificate and keep both barcodes tied to the saved Cert number.

## 2026-11-22 10:46 - Remove old intake route
- Remove the unused /search redirect now that card intake uses /register.

## 2026-11-22 10:44 - Register page
- Rename the Add Card URL to /register, preserve old links, and reduce desktop vertical spacing.

## 2026-11-22 10:40 - Condition grade guidance
- Show PSA grade equivalents in the Add Card condition selector while retaining the existing saved condition.

## 2026-11-22 10:36 - Add Card section headings
- Remove the numbered badges from the card image and details sections.

## 2026-11-22 10:34 - Card photo uploads
- Refresh the front and back photo dropzones with larger previews and an on-image remove control.

## 2026-11-22 10:23 - Card details form layout
- Give the card name a full row and place the certificate number beside condition with consistent row spacing.

## 2026-11-22 10:18 - Add Card page layout
- Reduce vertical spacing and keep the footer at the bottom when the form fits on screen.

## 2026-11-22 10:16 - Home shortcuts
- Link home feature cards to Add Card, My Vault, and Labels with new icons, and align the slimmer search bar with the cards.

## 2026-11-22 10:09 - Home search and feature cards
- Compact the certificate search, clarify its instructions, and frame the three home features.

## 2026-11-22 10:04 - Certificate search placeholder
- Match the certificate search placeholder text and typography to the reference.

## 2026-11-22 10:04 - Home page layout
- Update the home page with feature icons and a full-height layout that places the footer at the bottom.

## 2026-11-22 09:54 - Responsive home headline
- Scale the home headline to its available width so each phrase fits on its own line.

## 2026-11-22 09:52 - Home page messaging
- Refresh the home page headline and description, and remove the redundant brand label.

## 2026-11-22 09:46 - Red navigation bar
- Use a red navigation bar with white text and a larger DCR brand.

## 2026-11-22 09:45 - Global Source Serif 4 font
- Use the self-hosted Source Serif 4 font throughout the app and privacy policy.

## 2026-11-22 09:42 - Global Playfair Display font
- Use the self-hosted Playfair Display font throughout the app and privacy policy.

## 2026-11-22 09:35 - Larger website text
- Increase text sizes throughout the app and privacy policy for better readability.

## 2026-11-22 09:28 - Global Instrument Serif font
- Use the self-hosted Instrument Serif font throughout the app and privacy policy.

## 2026-11-22 09:23 - Certificate viewer image size
- Enlarge the viewer image and reduce the footer text size to make better use of the screen.

## 2026-11-22 09:23 - Production site address
- Deploy the site to dcrcards.pages.dev and retain the existing project for image authorization and older links.

## 2026-11-22 09:17 - Certificate viewer copyright text
- Complete the DCR attribution and copyright text below certificate images.

## 2026-11-22 09:14 - Certificate viewer home link
- Replace the viewer instruction with a linked DCR Card Vault attribution.

## 2026-11-22 09:11 - Stable certificate viewer layout
- Keep the viewer controls, thumbnails, and text in place when switching between images of different sizes.

## 2026-11-22 09:09 - Larger certificate images
- Scale certificate viewer images to use the available screen height while preserving their proportions.

## 2026-11-22 09:07 - Certificate download filenames
- Name downloaded images using the certificate number and selected side.

## 2026-11-22 09:04 - Certificate image download
- Add a download button for the selected image in the certificate viewer.

## 2026-11-22 09:02 - Certificate brand and year order
- Place Brand/Title before Year in certificate information.

## 2026-11-22 09:02 - Certificate field order
- Place Card Name before Set Name in certificate information.

## 2026-11-22 08:54 - Certificate information formatting
- Place Language last and use title case for item labels while keeping values uppercase.

## 2026-11-22 08:51 - Uppercase certificate information
- Display all item information in uppercase on certificate records.

## 2026-11-22 08:50 - Certificate information
- Show the saved condition, full language name, and Brand/Title on certificate records while preserving printed collector numbers.

## 2026-11-22 08:49 - Login page redesign
- Refresh the login page with the Discovery artwork, gentle motion, and clearer sign-in copy.

## 2026-11-22 08:46 - Illustrated login concepts
- Add five animated login previews with newly generated collector-themed imagery.

## 2026-11-22 08:42 - Login design concepts
- Add five standalone login design previews for review, with the existing Google sign-in represented as a mockup.

## 2026-11-22 08:32 - Certificate URLs
- Use /cert/<number> links for certificate searches while keeping existing verify links working.

## 2026-11-22 08:28 - Clean page URLs
- Use clean paths throughout the app and preserve existing hash links.

## 2026-11-22 08:25 - Certificate page cleanup
- Remove the redundant record found badge from certificate details.

## 2026-11-22 08:22 - Certificate detail page
- Show a searchable certificate record with card information, uploaded photos or a labeled catalog reference, and an enlarged image viewer.

## 2026-11-22 02:25 - Vault reference images
- Show matched catalog reference images in My Vault, falling back to the saved front photo when a reference is unavailable.
- Publish the local image index's public source URLs; image files remain in the local library and the source hosts serve them on demand.

## 2026-11-22 02:15 - On-demand card reading details
- Keep identification results available from the Card details information button without opening a dialog automatically.
- Disable and gray out identification while reading and show errors inline.

## 2026-11-22 01:52 - Prevent conflicting candidate selection
- Reject catalog candidates that conflict with the printed reading instead of combining their identities.
- Keep card saving independent of label layout and retain a failed save outcome when a retry succeeds.

## 2026-11-22 01:51 - Card evidence enrichment
- Add sourced Thai Charizard HP and illustrator and Japanese promo release year for review.

## 2026-11-22 01:49 - Metadata evidence validation
- Validate field evidence records and report catalog coverage per set in addition to language.

## 2026-11-22 01:47 - Card metadata audit and workflow
- Add a reproducible catalog coverage audit, field-level evidence examples, and an identification-to-form guide.

## 2026-11-22 01:21 - Preserve imported card images
- Add pinned image importers and preserve verified external images across catalog refreshes.

## 2026-11-22 01:25 - Clear outdated photo readings
- Clear unchanged identification values when the front photo changes, preserving user edits for review.
- Preserve manually edited values during a new reading and reject candidates that conflict with those values.
- Keep unresolved photo identities from being silently reattached through typed-card lookup.
- Prevent stale searches and cross-language suggestions from attaching an unrelated printing.
- Show and allow review of printed-language catalog candidates, preserving the printed collector number.
- Require verified printed-code evidence before automatically matching a catalog set ID.
- Use reviewed English set names for supported non-English releases.
- Offer number-and-language candidates for review when a printed name is missing or differs.
- Keep promo markers separate from rarity and include server reader tests in CI.
- Record owner-scoped identification diagnostics and schedule deletion of expired records.
- Store identification status and field provenance with new and imported cards.
- Preserve saved card fields when enriching label metadata and avoid relinking unresolved identifications.

## 2026-11-22 01:08 - Front photo review notice
- Warn when card details remain after the front photo changes.


## 2026-11-22 01:06 - Promo number matching
- Interpret an alphanumeric collector suffix as a promo set code rather than a numeric set count.


## 2026-11-22 01:03 - Card identification safeguards
- Avoid silently filling unverified set, year, and rarity values; flag conflicting anniversary readings for review.
- Retry catalog loading after a failure and invalidate the previous photo identity when the front image changes.


## 2026-11-22 00:21 - Expand multilingual set reference
- Add sourced set-name and identifier snapshots across 15 languages, additional Japanese references, and the Thai MA6 example.


## 2026-11-22 00:12 - Set code research reference
- Add a multilingual set inventory, pinned English abbreviation source, and guidance distinguishing printed marks, catalog IDs, and promo identifiers.

## 2026-11-21 20:54 - Preserve card reading values
- Fill available English set and year readings even when the printed-language catalog has no match; mark unmatched readings for review.
- Distinguish an unavailable catalog from a missing record and show the English set reading in the identification dialog.

## 2026-11-21 20:50 - Restore application startup
- Reuse the shared language check in card identification to avoid invalid JavaScript syntax that prevented the entire app from loading.
- Add a JavaScript syntax regression test for the card identification page and run application tests before deployment.

## 2026-11-21 20:46 - Printed card identity review
- Read printed collector numbers, set codes, symbols, stamps and copyright separately before suggesting a printing.
- Match the original-language catalog by set and collector number, check known denominators and conflicting card details, and keep unverified English counterparts out of the form.
- Show the original collector number and make missing catalog matches and unverified translations clear during intake.

## 2026-11-21 07:59 - Localized card matching and automatic rarity
- Fail over across configured Gemini keys on non-quota key, configuration, timeout, network, and upstream errors; keep quota/rate-limit responses terminal.
- Keep the existing single Gemini key as a final fallback when a multi-key pool is configured.
- Read the full visible card with an English Gemini prompt, including attack/ability effects, printed text, regulation mark, and per-field confidence.
- Match the printed-language catalog record and metadata first, map it to English label data, auto-fill only a unique high-confidence identity, and show source-language images for review choices.
- Fill the read-only rarity field from the selected English card record or reviewed uniform set default; keep unknown rarity blank.

## 2026-11-21 06:55 - Cloudflare fetch redirect compatibility
- Use Cloudflare Workers-supported manual redirects for Gemini, Oracle OCR, and Oracle media requests; upstream redirects are not followed.
- Cover the supported redirect mode in the card-identification regression test.

## 2026-11-21 06:45 - Gemini network failure fallback
- Use the deployed Oracle OCR pipeline when Gemini cannot be reached or returns no usable identity fields.
- Preserve safe fetch failure diagnostics (error name/code and elapsed time) without logging request data or credentials.
- Disclose the Oracle OCR fallback in Add Card and documentation.

## 2026-11-21 06:12 - Gemini transient failure recovery
- Retry Gemini once after a network error or upstream 5xx, without retrying quota, configuration, or timeout failures.
- Return a privacy-safe request reference for reading failures and log it with the failure class and upstream status for diagnosis.
- Show the short reference in the Add Card error state so a future production failure can be matched to Cloudflare logs.

## 2026-11-21 05:55 - Gemini card identification
- Replaced Oracle OCR and Gemma fallback calls in Add Card with one server-side `gemini-3.5-flash-lite` image-reading request.
- Added structured field parsing, safe quota/configuration errors, confidence-gated catalog auto-fill, and non-automatic English catalog review suggestions when an exact match is unavailable.
- Disclosed Gemini image processing in the Add Card intake flow and kept the API key out of Git and browser code.
- Kept Oracle media storage for saved card photos, removed unused OCR/Gemma Pages adapters and Workers AI binding, and documented the Gemini Pages secret requirement.

## 2026-11-20 19:32 - Oracle hostname routing
- Routed the Oracle OCR and media origins through `https://217-142-238-24.sslip.io` with a trusted hostname certificate and deployed the Pages configuration successfully.
- Added deployment validation that skips production publishing when the hostname or other required settings are missing or invalid.
- Added safe Oracle request failure codes and separated OCR availability from Gemma fallback status in the card identification response.
- Updated the Nginx origin template and rollout documentation for hostname TLS; verified the authenticated OCR pipeline against a supplied card scan through the production origin.

## 2026-11-20
- Restore the existing OCR-first Python card-identification pipeline as the Add Card primary path, call Gemma only after OCR cannot uniquely match, and route Gemma fields back through the same local catalog matcher.
- Auto-fill the English catalog record when the Python pipeline returns an exact TCGdex card ID; add a private, loopback-only Oracle OCR adapter with temporary scan cleanup and document its ARM64/PaddleOCR deployment preflight.
- Disable Gemma's default reasoning mode for card OCR, use max_completion_tokens with the prior 2048-token budget, and log finish reason, token usage, refusals, and tool calls when a response has no identity fields.
- Harden the Gemma reader to accept nested and alternate response shapes, preserve numeric identity values, recover JSON from fenced or prose-wrapped responses, and prioritize identity fields with a smaller output budget.
- Keep English catalog candidates for translated cards when their printed collector number differs from the English printing; use strong name evidence and let the user confirm the match.
- Treat a series name as broad context, not an exact set match; rank translated-card candidates by English name, observed year and rarity, and nearby collector numbers so a localized printing does not get replaced by an unrelated same-name card.
## 2026-11-19
- Give card-reading failures a clear explanation and a retry action for temporary service errors.
- Scope rarity choices to the selected set, add source-verified uniform rarity values for McDonald's collections, document the verified no-rarity sets, use the approved year/series map for existing cards, and pair non-English scans with English catalog cards even when catalog IDs differ.
- Route candidate artwork through a same-origin catalog image endpoint, add same-card English artwork fallback, and show saved front photos in My Vault without unrelated sample-card placeholders.
- Add owner-checked front/back image APIs and a private Oracle VM systemd image store; keep Node loopback-only behind the planned TLS proxy.
- Configure the Oracle VM Nginx ACME/HTTPS edge and Let's Encrypt short-lived IP certificate with automatic renewal and reload; allow only TCP 80/443 in the VCN and host firewall.
- Enable one-to-eight-digit Cert input with canonical eight-digit display, per-account availability checks, inline duplicate guidance, and a random available Cert button.
- Add live TCGdex metadata suggestions for name, set, year, and card number, and generate the compact web index from the pinned local catalog snapshot.
- Add explicit Gemma 4 front-image reading, fuzzy catalog candidate ranking, rarity intake, and a required user choice before saving card details.
- Extract the local TCGdex card-image library under `dcr-tag-70x20/catalog/card-image-library/` and keep its downloaded images and SQLite index out of Git.
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
# Set inventory reconciliation - 2026-11-22

- Refresh multilingual set inventories, add official Thai product search entries, and retain potentially conflicting IDs for review instead of merging them automatically.
- Add a second independent language-by-language set-list snapshot for comparison; preserve unlinked entries and source-specific identifiers.
- Add official Japanese, Korean, and additional Southeast and East Asian regional product search filters, retaining their separate scopes.
- Add a source-qualified set name and code index with separate deck-list abbreviations and verified printed-code evidence.
- Capture an additional English set-code source with its reported on-card status, preserving shared codes and unconfirmed entries.
- Index official set-mark images and sample card URLs from archived Japanese, Korean, and Traditional Chinese records and the live Thai product filters.

## 2026-11-22 - Separate profile editing
- Save profile photos independently from personal details and allow positioning photos with a circular crop guide.

- Added location card management with the shared vault picker, sorting, and location options menu.
