# Data Model

All timestamps are Unix seconds unless noted otherwise. D1 is the source of truth for signed-in records.

## User

- `id`: random DCR Vault UUID used for internal foreign keys
- `google_sub`: stable Google account subject; server-side only
- `email`, `display_name`, `avatar_url`: basic Google profile fields
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
- `grade_label`: GEM MT 10 | GEM MT 9 | RAW, or another DCR grade label
- `cert_number`: 8 digits; unique within the owner's vault
- `status`: in-vault | for-sale | sold | grading
- `buy_price`, `sell_price`: private D1 values, shown only in Vault detail
- `buy_date`, `sold_date`, `bought_from`, `sold_to`, `notes`
- `created_at`, `updated_at`
- Images are not stored by this release. Legacy browser imports omit image data.

## Privacy boundaries

- API requests use the session's server-resolved `user_id`; clients cannot choose an owner ID.
- Certificate lookup searches only the signed-in user's cards. There is no public cross-account lookup endpoint.
- `buy_price`, `sell_price`, purchase sources, and notes are not returned on the public homepage or printed label.
- Migration from `dcr-cards-v1` is user-confirmed per selected card and keeps the original browser copy in place.

## Schema

The initial schema is in [`migrations/0001_users_sessions_cards.sql`](../migrations/0001_users_sessions_cards.sql).
