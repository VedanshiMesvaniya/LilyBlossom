import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/admin/crawler/run
// Only an authenticated admin, or the scheduler using CRAWLER_SECRET,
// may trigger a crawl. This route does not run the crawler itself
// (Python is a separate worker, see crawler/); it records a queued
// run and calls the worker's HTTP endpoint.
export async function POST(request: Request) {
  const secretHeader = request.headers.get("x-crawler-secret");
  const isScheduler = Boolean(secretHeader) && secretHeader === process.env.CRAWLER_SECRET;

  if (!isScheduler) {
    await requireAdmin();
  }

  const admin = createAdminClient();
  const { data: run, error } = await admin
    .from("crawl_runs")
    .insert({ status: "queued", started_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // In production this notifies the deployed Python worker (Render,
  // Railway, Fly.io, etc.) to start processing `run.id`. Wiring that
  // HTTP call is deployment-specific, see docs/DEPLOYMENT.md.

  return NextResponse.json({ run });
}
