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
Trusted GL sources checked
     |
New, updated, duplicate, and uncertain items identified
     |
Stored as crawl_items, linked to the crawl_run that found them
     |
Admin opens /admin/review
     |
Admin publishes, rejects, merges, or corrects each item
     |
Published titles become visible to everyone
```

## Pages

- `/admin`: counts of series, movies, currently airing, upcoming, and
  pending announcements, with links into the rest of the admin area.
- `/admin/crawler`: the most recent crawl run's stats, and a button to
  trigger a new run on demand.
- `/admin/review`: every `crawl_item` still in the `new` or `uncertan`
  state, with match confidence, so an admin can decide whether to
  publish, reject, or merge it.
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
