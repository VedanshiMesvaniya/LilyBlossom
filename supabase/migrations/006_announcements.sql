create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null,
  content text not null,
  cover_image text,
  related_title_id uuid references titles(id),
  source_url text,
  source_name text,
  announcement_type text not null check (
    announcement_type in ('New Release', 'Release Date', 'Trailer', 'Casting', 'Production', 'Streaming', 'Poster', 'Status Update', 'Other GL')
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcements_status on announcements (status);
create index if not exists idx_announcements_published_at on announcements (published_at);
