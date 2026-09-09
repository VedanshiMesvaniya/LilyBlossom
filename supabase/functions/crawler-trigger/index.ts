// Supabase Edge Function invoked by pg_cron on a daily schedule
// (see docs/CRAWLER.md for the cron.schedule() call). It does not
// crawl anything itself; it authenticates with CRAWLER_SECRET and
// calls the deployed Python backend's /run endpoint (crawler/worker.py),
// which queues a run and starts the actual crawl.
//
// Deploy with: supabase functions deploy crawler-trigger

Deno.serve(async () => {
  const backendUrl = Deno.env.get("BACKEND_URL");
  const crawlerSecret = Deno.env.get("CRAWLER_SECRET");

  if (!backendUrl || !crawlerSecret) {
    return new Response(JSON.stringify({ error: "Missing BACKEND_URL or CRAWLER_SECRET." }), {
      status: 500
    });
  }

  const response = await fetch(`${backendUrl}/run`, {
    method: "POST",
    headers: { "x-crawler-secret": crawlerSecret, "Content-Type": "application/json" },
    body: JSON.stringify({ dry_run: false })
  });

  const body = await response.text();
  return new Response(body, { status: response.status });
});
