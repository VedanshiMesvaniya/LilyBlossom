-- Seeds the three current crawler adapters into the sources table, so
-- Admin -> Sources has real rows to enable/disable from the start
-- instead of an empty table the crawler's registry silently ignored
-- (see crawler/main.py's load_enabled_sources()).

insert into sources (name, url, source_type, priority)
values
  ('GL Archive', 'https://glarchive.net/catalog/', 'catalog', 10),
  ('AniList', 'https://anilist.co/graphiql', 'catalog', 20),
  ('TMDB', 'https://www.themoviedb.org', 'catalog', 30)
on conflict (name) do nothing;
