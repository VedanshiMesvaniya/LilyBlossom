import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/search?q=...
// Uses PostgreSQL full-text search (see supabase/migrations/008_indexes.sql
// for the generated tsvector column and GIN index this depends on).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) return NextResponse.json({ results: [] });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("titles")
    .select("slug, type, canonical_title, release_year, country, poster_url, release_status")
    .eq("is_published", true)
    .textSearch("search_vector", q, { type: "websearch" })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data });
}
