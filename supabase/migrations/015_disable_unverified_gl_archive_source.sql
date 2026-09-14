-- GL Archive (glarchive.net) could not be verified as a real, reachable
-- catalog site. A web search for the domain found no indexed pages, and
-- the only real "Girls Love Archive" presence found is a social media
-- account with a simple linktree style page, not a database with
-- listing and pagination pages like crawler/sources/gl_archive.py
-- assumes. Disabling this source here so the daily crawl stops trying
-- to reach a site that does not appear to exist, until someone
-- confirms a real replacement or working URL. See docs/CRAWLER.md.

update sources
set enabled = false,
    last_error = 'Disabled: glarchive.net could not be confirmed as a real, reachable catalog site. See docs/CRAWLER.md.'
where name = 'GL Archive';
