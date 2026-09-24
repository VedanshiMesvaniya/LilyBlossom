-- One row per season of a series: number, name, episode count and air
-- date. Filled by the crawler from TMDB's /tv/{id} details, which the
-- titles table alone could not hold (titles only has a single
-- episode_count). The title detail page reads it to list the seasons.

create table if not exists title_seasons (
  title_id uuid not null references titles(id) on delete cascade,
  season_number int not null check (season_number >= 0),
  name text,
  episode_count int check (episode_count is null or episode_count >= 0),
  air_date date,
  updated_at timestamptz not null default now(),
  primary key (title_id, season_number)
);

alter table title_seasons enable row level security;

-- Anyone can read the seasons of a published title. Admins can read and
-- write everything. The crawler uses the service role, which bypasses RLS.
drop policy if exists "public read title_seasons" on title_seasons;
create policy "public read title_seasons" on title_seasons for select using (
  is_admin()
  or exists (select 1 from titles t where t.id = title_seasons.title_id and t.is_published)
);

drop policy if exists "admin write title_seasons" on title_seasons;
create policy "admin write title_seasons" on title_seasons for all using (is_admin()) with check (is_admin());
