-- Global catalog. Written only by the crawler pipeline or an admin
-- (see docs/DATABASE.md, "catalog admin rule").

create table if not exists countries (
  code text primary key,
  name text not null
);

create table if not exists genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists streaming_platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text
);

create table if not exists titles (
  id uuid primary key default gen_random_uuid(),
  canonical_title text not null,
  original_title text,
  canonical_slug text not null unique,
  type text not null check (type in ('series', 'movie')),
  country text references countries(code),
  language text,
  release_year int,
  release_date date,
  release_status text not null default 'Announced'
    check (release_status in ('Announced', 'In Production', 'Upcoming', 'Airing', 'Completed', 'Cancelled')),
  description text,
  poster_url text,
  backdrop_url text,
  episode_count int,
  runtime_minutes int,
  official_url text,
  tmdb_id text,
  imdb_id text,
  classification_source text,
  is_published boolean not null default false,
  is_locked boolean not null default false,
  merged_into uuid references titles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists title_genres (
  title_id uuid references titles(id) on delete cascade,
  genre_id uuid references genres(id) on delete cascade,
  primary key (title_id, genre_id)
);

create table if not exists title_streaming (
  title_id uuid references titles(id) on delete cascade,
  platform_id uuid references streaming_platforms(id) on delete cascade,
  url text,
  primary key (title_id, platform_id)
);

create table if not exists poster_assets (
  id uuid primary key default gen_random_uuid(),
  title_id uuid references titles(id) on delete cascade,
  storage_path text not null,
  source_url text,
  source_name text,
  hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_poster_assets_hash on poster_assets (title_id, hash);
