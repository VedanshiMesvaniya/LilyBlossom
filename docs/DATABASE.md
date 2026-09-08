# Database

All schema lives in `supabase/migrations/`, run in numeric order. This
file explains the rules behind the schema, not just the columns.

## The one rule that matters most

The global catalog (`titles` and everything that hangs off it) and a
user's personal tracking (`user_media_status`) are two different
things and must never be conflated.

A title's global `release_status` might be `Completed`. A specific
user's personal `status` for that same title might be `Watching`,
because they have not finished it yet. Nothing in the app should ever
write personal state into the `titles` row, or read the global
`release_status` as if it were a personal watch state.

## Who can write what

| Table | Written by |
| --- | --- |
| `profiles` | The user themself (own row only) |
| `titles`, `genres`, `title_genres`, `title_streaming`, `poster_assets` | The crawler pipeline (service role) or an admin |
| `user_media_status` | The signed in user, own rows only |
| `sources`, `title_sources` | An admin |
| `crawl_runs`, `crawl_items`, `title_changes` | The crawler pipeline (service role); read only for admins |
| `announcements` | Crawler creates drafts; only an admin publishes |
| `admin_actions` | Written automatically whenever an admin route performs a protected action |
| `poster_assets` | The crawler's poster handler, after hashing to avoid duplicate storage |

This is enforced twice: once in `009_rls.sql` at the database level,
and once in the API route handlers, which check `requireAdmin()` before
doing anything privileged. The RLS policies are the real boundary. The
route level checks exist so a mistake fails fast during development
instead of only being caught by RLS in production.

## Key tables

- `titles`: the shared catalog. `is_published` gates whether normal
  users can see a row at all; unpublished rows exist for the admin
  review workflow.
- `user_media_status`: primary key is `(user_id, title_id)`, so a user
  can have exactly one status per title. A trigger automatically flips
  `status` to `watched` when `progress` reaches 100, but the user can
  still change it back manually afterward.
- `sources`: the explicit allow list the crawler is permitted to visit.
  Nothing outside this table is ever crawled.
- `crawl_items`: one row per item a crawl run discovered, with its
  match confidence and resulting state (`new`, `duplicate`,
  `uncertain`, and so on). This is what populates the admin review
  queue.
- `title_changes`: history of every detected metadata change to a
  published title, so nothing is silently overwritten.
- `announcements`: `status` moves from `draft` to `published` only
  through an admin action, recorded in `admin_actions`.

## Full text search

`008_indexes.sql` adds a generated `search_vector` column on `titles`
and a GIN index on it. `/api/search` uses `textSearch` against that
column. If you add a field that should be searchable (an alias table,
for example), extend the generated column expression there rather than
adding a second search path.

## Keeping this file current

If a migration changes a table's shape or its write rules, update the
relevant row or paragraph here in the same change.
