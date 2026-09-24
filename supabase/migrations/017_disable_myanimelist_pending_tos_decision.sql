-- Jikan's own project pages (github.com/jikan-me/jikan, jikan-rest, and
-- its RapidAPI/apiary listings) state that using the API to populate
-- your own database breaches MyAnimeList's Terms of Service. This
-- crawler does exactly that, so this source is disabled by default
-- until a person decides whether that risk is acceptable, the same
-- way 015 disabled GL Archive for a different reason. The API itself
-- is real and working, verified with live data, this is a policy
-- question, not a working/not-working question. See docs/CRAWLER.md.

update sources
set enabled = false,
    last_error = 'Disabled: Jikan''s own docs say populating your own database with its data breaches MyAnimeList''s Terms of Service. See docs/CRAWLER.md.'
where name = 'MyAnimeList';
