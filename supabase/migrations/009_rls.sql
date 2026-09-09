-- Row Level Security. Frontend role checks are never trusted alone;
-- these policies are the real boundary.

alter table profiles enable row level security;
alter table titles enable row level security;
alter table genres enable row level security;
alter table title_genres enable row level security;
alter table countries enable row level security;
alter table streaming_platforms enable row level security;
alter table title_streaming enable row level security;
alter table user_media_status enable row level security;
alter table sources enable row level security;
alter table title_sources enable row level security;
alter table crawl_runs enable row level security;
alter table crawl_items enable row level security;
alter table title_changes enable row level security;
alter table announcements enable row level security;
alter table admin_actions enable row level security;
alter table poster_assets enable row level security;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Profiles: public username/avatar read, owner-only update.
create policy "profiles are publicly readable" on profiles
  for select using (true);
create policy "users update their own profile" on profiles
  for update using (auth.uid() = id);

-- Titles: public read of published rows only; admin manages everything.
create policy "published titles are publicly readable" on titles
  for select using (is_published = true or is_admin());
create policy "admins manage titles" on titles
  for all using (is_admin()) with check (is_admin());

-- Reference tables: public read, admin write.
create policy "public read genres" on genres for select using (true);
create policy "admin write genres" on genres for all using (is_admin()) with check (is_admin());
create policy "public read title_genres" on title_genres for select using (true);
create policy "admin write title_genres" on title_genres for all using (is_admin()) with check (is_admin());
create policy "public read countries" on countries for select using (true);
create policy "admin write countries" on countries for all using (is_admin()) with check (is_admin());
create policy "public read streaming_platforms" on streaming_platforms for select using (true);
create policy "admin write streaming_platforms" on streaming_platforms for all using (is_admin()) with check (is_admin());
create policy "public read title_streaming" on title_streaming for select using (true);
create policy "admin write title_streaming" on title_streaming for all using (is_admin()) with check (is_admin());
create policy "public read poster_assets" on poster_assets for select using (true);
create policy "admin write poster_assets" on poster_assets for all using (is_admin()) with check (is_admin());

-- User tracking: strictly owner-only.
create policy "users read own tracking" on user_media_status
  for select using (auth.uid() = user_id);
create policy "users write own tracking" on user_media_status
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sources, crawl internals: admin only. The crawler worker uses the
-- service-role key and bypasses RLS entirely (see lib/supabase/admin.ts).
create policy "admin manages sources" on sources for all using (is_admin()) with check (is_admin());
create policy "admin manages title_sources" on title_sources for all using (is_admin()) with check (is_admin());
create policy "admin reads crawl_runs" on crawl_runs for select using (is_admin());
create policy "admin reads crawl_items" on crawl_items for select using (is_admin());
create policy "admin reads title_changes" on title_changes for select using (is_admin());
create policy "admin reads admin_actions" on admin_actions for select using (is_admin());

-- Announcements: public read of published rows only; admin manages drafts.
create policy "published announcements are publicly readable" on announcements
  for select using (status = 'published' or is_admin());
create policy "admin manages announcements" on announcements
  for all using (is_admin()) with check (is_admin());
