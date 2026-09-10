-- Adds anilist_id alongside the existing tmdb_id and imdb_id columns
-- on titles, so the crawler's deduplicator can match an incoming item
-- to an existing title by a shared external ID before falling back to
-- fuzzy title matching (see crawler/deduplicator.py).

alter table titles add column if not exists anilist_id text;

create index if not exists idx_titles_tmdb_id on titles (tmdb_id) where tmdb_id is not null;
create index if not exists idx_titles_anilist_id on titles (anilist_id) where anilist_id is not null;
create index if not exists idx_titles_imdb_id on titles (imdb_id) where imdb_id is not null;
