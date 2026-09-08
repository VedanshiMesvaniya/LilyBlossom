-- Explicit allow-list of crawlable sources. The crawler must not visit
-- anything outside this table.

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  url text not null,
  enabled boolean not null default true,
  source_type text not null check (source_type in ('catalog', 'metadata', 'announcement')),
  priority int not null default 100,
  last_crawled_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists title_sources (
  title_id uuid references titles(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  source_url text,
  primary key (title_id, source_id)
);

create index if not exists idx_sources_enabled on sources (enabled);
