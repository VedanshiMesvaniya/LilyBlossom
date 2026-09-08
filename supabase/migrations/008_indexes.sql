-- Extra indexes plus the full-text search column used by /api/search.

create index if not exists idx_titles_canonical_title on titles (canonical_title);
create index if not exists idx_titles_type on titles (type);
create index if not exists idx_titles_release_year on titles (release_year);
create index if not exists idx_titles_release_status on titles (release_status);

alter table titles add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple', coalesce(canonical_title, '') || ' ' || coalesce(original_title, '') || ' ' || coalesce(country, ''))
  ) stored;

create index if not exists idx_titles_search_vector on titles using gin (search_vector);
