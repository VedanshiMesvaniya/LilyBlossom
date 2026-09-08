// Supabase Edge Function invoked by pg_cron on a daily schedule
// (see docs/CRAWLER.md for the cron.schedule() call). It does not
// crawl anything itself; it authenticates with CRAWLER_SECRET and
// asks the Next.js app to queue a run, which in turn notifies the
// separate Python worker.
//
// Deploy with: supabase functions deploy crawler-trigger

Deno.serve(async () => {
  const appUrl = Deno.env.get("APP_URL");
  const crawlerSecret = Deno.env.get("CRAWLER_SECRET");

  if (!appUrl || !crawlerSecret) {
    return new Response(JSON.stringify({ error: "Missing APP_URL or CRAWLER_SECRET." }), {
      status: 500
    });
  }

  const response = await fetch(`${appUrl}/api/admin/crawler/run`, {
    method: "POST",
    headers: { "x-crawler-secret": crawlerSecret }
  });

  const body = await response.text();
  return new Response(body, { status: response.status });
});
