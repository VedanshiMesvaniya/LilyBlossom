# Admin workflow

## Becoming an admin

There is no signup flow for admin accounts. An existing admin, or a
database owner, sets `profiles.role = 'admin'` directly, see
`docs/SETUP.md` step 6. `/admin` and every `/admin/*` page is wrapped
in the `RequireAdmin` component (`src/components/ProtectedRoute.jsx`),
which checks this column. A non admin who navigates to `/admin` gets
an explicit message, not a hidden page that merely looks empty. The
two admin actions that write an audit log entry (editing a title,
changing an announcement's status) go through the Python backend
(`crawler/worker.py`), which independently checks the same column
before doing anything, since a page-level check alone is never the
real boundary, see "What admins cannot bypass" below.

## Daily flow

```
Crawler runs
     |
Trusted, enabled GL sources checked (Admin -> Sources controls this list)
     |
New titles created, existing titles updated, unclear matches held back
     |
Every item stored as a crawl_item, linked to the crawl_run that found it
     |
Admin opens /admin/review
     |
Admin resolves any uncertain items (publish, reject, or merge),
and publishes whichever crawler-created titles are ready to go live
     |
Published titles (is_published = true) become visible to everyone
```

Titles the crawler is confident about (a brand new title, or an
update to one it already knows) are written to `titles` right away,
but always with `is_published = false`, so review still happens
before anything is public, it just happens as "check and publish"
rather than "create from scratch." Only a genuinely unclear match
still sits purely in `crawl_items` until a human resolves it. See
`docs/CRAWLER.md` and `ARCHITECTURE.md`'s "Data flow for a new title".

## Pages

- `/admin`: counts of series, movies, currently airing, upcoming, and
  pending announcements, with links into the rest of the admin area.
- `/admin/crawler`: the most recent crawl run's stats, and a button to
  trigger a new run on demand.
- `/admin/review`: every `crawl_item` in the `new`, `updated`, or
  `uncertain` state, with match confidence, so an admin can publish a
  crawler-created or crawler-updated title, or decide whether to
  publish, reject, or merge an uncertain one.
- `/admin/announcements`: every announcement, draft or published, with
  publish and unpublish actions.
- `/admin/sources`: the crawlable source allow list, with the last
  crawl time and last error for each, so a failing source is visible
  without digging through logs.

## Audit log

Every publish, unpublish, edit, merge, delete, approve, reject, and
crawler run performed by an admin is written to `admin_actions` with
the admin's id, the old value, and the new value. The endpoints in
`crawler/worker.py` write this row automatically; a new admin action
should follow the same pattern rather than skip logging.

## What admins cannot bypass

Row Level Security in `supabase/migrations/009_rls.sql` is the real
boundary, not the admin checks in `RequireAdmin` or
`crawler/worker.py`. Even if one of those checks had a bug, RLS still
blocks a non admin from writing to `titles`, `sources`, or
`announcements` directly.
