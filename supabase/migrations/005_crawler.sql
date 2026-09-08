-- Crawl run logging, discovered items, and metadata change history.

create table if not exists crawl_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds int,
  status text not null default 'queued' check (status in ('queued', 'running', 'success', 'partial_success', 'failed')),
  sources_checked int not null default 0,
  items_found int not null default 0,
  new_items int not null default 0,
  updated_items int not null default 0,
  duplicates int not null default 0,
  uncertain_items int not null default 0,
  errors int not null default 0
);

create table if not exists crawl_items (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid references crawl_runs(id) on delete cascade,
  source_id uuid references sources(id),
  raw_title text not null,
  normalized_title text,
  payload jsonb not null,
  matched_title_id uuid references titles(id),
  match_confidence numeric(4, 3),
  state text not null default 'new' check (state in ('new', 'existing', 'updated', 'duplicate', 'uncertain', 'error')),
  detected_at timestamptz not null default now()
);

create table if not exists title_changes (
  id uuid primary key default gen_random_uuid(),
  title_id uuid references titles(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  source_id uuid references sources(id),
  crawl_item_id uuid references crawl_items(id),
  detected_at timestamptz not null default now()
);

create index if not exists idx_crawl_items_state on crawl_items (state);
create index if not exists idx_title_changes_title on title_changes (title_id);
