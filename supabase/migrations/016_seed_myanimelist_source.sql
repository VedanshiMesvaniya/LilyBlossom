-- MyAnimeList, via the free, keyless Jikan REST API (api.jikan.moe).
-- Verified as a real, working, free source before adding: no API key
-- or signup needed, MIT licensed, published rate limit (60/min,
-- 3/sec), and MAL's own Girls Love (formerly Yuri) genre tagging
-- covers series and movies from any country of origin, not only
-- Japan. See crawler/sources/jikan.py and docs/CRAWLER.md.

insert into sources (name, url, source_type, priority)
values ('MyAnimeList', 'https://api.jikan.moe/v4', 'catalog', 25)
on conflict (name) do nothing;
