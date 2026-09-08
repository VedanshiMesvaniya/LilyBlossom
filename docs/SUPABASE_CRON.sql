-- Run once against the Supabase SQL editor to schedule the daily crawl.
-- Requires the pg_cron and pg_net extensions, both enabled by default
-- on Supabase projects.

select cron.schedule(
  'gl-tracker-daily-crawl',
  '0 3 * * *', -- 03:00 UTC daily
  $$
  select net.http_post(
    url := 'https://<project-ref>.functions.supabase.co/crawler-trigger',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
