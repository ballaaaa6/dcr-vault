# Data Model

All timestamps are Unix seconds unless noted otherwise. D1 is the source of truth for signed-in records.

## User

- `id`: random DCR Vault UUID used for internal foreign keys
- `google_sub`: stable Google account subject; server-side only
- `email`: Google account email; `display_name` and `avatar_url`: initially from Google, then editable by the account owner. Uploaded avatars are resized JPEG data stored in `avatar_url` and remain unchanged on later sign-ins.
- `created_at`, `updated_at`

## Session

- `token_hash`: SHA-256 hash of the opaque cookie token; the raw token is never stored
- `user_id`: owner, references `users.id`
- `expires_at`, `created_at`

## Card

- `id`: random UUID
- `user_id`: owner, references `users.id`
- `game`: pokemon | yugioh | other
- `name`, `set_name`, `year`, `card_number`, `rarity`
- `year_series`: legacy intake metadata. Label generation uses `year`, `card_type_label`, `source_language`, `language_label`, and the reviewed `series`; older records may resolve the source-set series from the catalog.
- `catalog_card_id`: exact English catalog printing used for label values
- `source_language`, `source_set_id`, `source_card_id`, `source_finish`: exact printed-language source identity and observed finish used to audit the localized-to-English match
- `grade_label`: one of the DCR condition terms when assessed; the label prints the condition term without a numeric grade
- `cert_number`: stored as 8 digits; input accepts one to eight digits and is left-padded with zeroes; unique across all accounts
- `status`: in-vault | for-sale | sold | grading
- `buy_price`, `sell_price`: private D1 values, shown only in Vault detail
- `buy_date`, `sold_date`, `bought_from`, `sold_to`, `notes`: private collection details
- `artist`: optional illustrator name, editable in Vault
- `created_at`, `updated_at`
- Front/back images are stored on the Oracle VM. D1 keeps an opaque object key, content type, byte size, SHA-256 digest, and update time per card side. Legacy browser imports omit image data.

## Card image

- Primary key: `card_id`, `side` (`front` or `back`)
- `user_id`: owner used for server-side access checks
- `object_key`: `<owner-uuid>/<card-uuid>/<side>.<jpg|png|webp>`
- `content_type`, `byte_size` (1 to 10 MiB), `sha256`, `updated_at`

## Image capability

- A random token hash authorizes one card side and one operation (`put`, `get`, or `delete`) for 120 seconds.
- The capability is consumed atomically by the Pages authorization endpoint and is never the user's DCR session token.

## Privacy boundaries

- Private API requests use the session's server-resolved `user_id`; clients cannot choose an owner ID.
- Public certificate lookup searches all accounts using the canonical eight-digit number and returns only certificate details and card photos.
- Image upload, replacement, and deletion require ownership; card photos are publicly readable.
- `buy_price`, `sell_price`, purchase sources, and notes are not returned on the public homepage or printed label.
- Migration from `dcr-cards-v1` is user-confirmed per selected card and keeps the original browser copy in place.

## Schema

Schema history is in [`migrations/`](../migrations/), including the image metadata and one-use capability tables.

- `favorite_series` and `bio`: optional account-owned profile details, limited to 80 and 240 characters respectively. Apply migration `0011_profile_details.sql` before deploying this profile update.
