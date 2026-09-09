# Third-party notices

This project's own code is licensed under the MIT License, see
[LICENSE](./LICENSE). That license does not cover the resources listed
below. Each one remains the property of its own rights holder and is
used under its own license or terms.

## Open source packages

- The JavaScript dependencies listed in `package.json` (including
  React, Vite, react-router-dom, Tailwind CSS, and
  @supabase/supabase-js) are each used under their own open source
  license. Most of them are MIT. The exact license for each package is
  in that package's own repository. Installed copies live in
  `node_modules` after `npm install` and are not committed to this
  repository.
- The Python dependencies listed in `crawler/requirements.txt`
  (including httpx, BeautifulSoup4, lxml, Pydantic, rapidfuzz,
  supabase-py, python-dotenv, Playwright, and tenacity) are each used
  under their own open source license, a mix of MIT, BSD, and
  Apache 2.0. The exact license for each package is in that package's
  own repository.

## Fonts

- Playfair Display and Quicksand, used for on-screen text (see
  `index.html` and `tailwind.config.js`), are Google Fonts licensed
  under the SIL Open Font License 1.1. They are loaded from Google's
  font service at run time and are not bundled in this repository.

## TMDB

- If `TMDB_API_KEY` is configured, `crawler/sources/tmdb.py` calls The
  Movie Database (TMDB) API to fill in poster images and descriptions.
  This use is subject to TMDB's own terms of use, which require
  attribution wherever TMDB sourced data or images are shown:
  "This product uses the TMDB API but is not endorsed or certified by
  TMDB." Add that line to the app before enabling this enrichment in
  production, see `docs/CRAWLER.md`.

## Third-party GL catalog sources

- The crawler (`crawler/sources/`) reads publicly available listing
  pages from an explicit allow list of GL catalog sites: GL Archive,
  GL Central, GLThai, and ShipsBloom. Titles, descriptions, posters,
  and other metadata found this way are used for cataloging and
  discovery only. They remain the property of their original sources
  and any underlying rights holders, such as studios, publishers, or
  streaming platforms. This project does not claim ownership over
  that content. An admin reviews every item before it is published,
  see `docs/ADMIN.md` and `docs/CRAWLER.md`.

## Supabase

- Authentication, the database, storage, and scheduled jobs run on
  Supabase, a hosted third-party service used under Supabase's own
  terms of service. No Supabase source code is redistributed in this
  repository.

## Keeping this file current

This file is not legal advice, it is a record of what this project
uses and under what conditions. If a resource's terms change, or a new
one is added (a new crawler source, a new package, a new API), update
this file in the same change, the same way ARCHITECTURE.md is kept
current when the architecture changes.
