-- Personal tracking state. Always separate from the global title row,
-- so one user's "Watching" never changes what other users see.

create table if not exists user_media_status (
  user_id uuid references profiles(id) on delete cascade,
  title_id uuid references titles(id) on delete cascade,
  status text not null check (status in ('plan_to_watch', 'watching', 'watched', 'dropped')),
  current_episode int,
  progress numeric(5, 2) check (progress >= 0 and progress <= 100),
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create index if not exists idx_user_media_status_user on user_media_status (user_id);
create index if not exists idx_user_media_status_title on user_media_status (title_id);

-- Auto-complete a title once progress hits 100, mirroring section 12/13
-- of the product spec. The user can still change it back manually.
create or replace function set_watched_on_full_progress()
returns trigger as $$
begin
  if new.progress is not null and new.progress >= 100 then
    new.status := 'watched';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_watched_on_full_progress on user_media_status;
create trigger trg_set_watched_on_full_progress
  before insert or update on user_media_status
  for each row execute function set_watched_on_full_progress();
