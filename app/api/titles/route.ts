import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/titles?type=series|movie&year=&country=&releaseStatus=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = createClient();

  let query = supabase.from("titles").select("*").eq("is_published", true);

  const type = searchParams.get("type");
  const year = searchParams.get("year");
  const country = searchParams.get("country");
  const releaseStatus = searchParams.get("releaseStatus");

  if (type) query = query.eq("type", type);
  if (year) query = query.eq("release_year", Number(year));
  if (country) query = query.eq("country", country);
  if (releaseStatus) query = query.eq("release_status", releaseStatus);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ titles: data });
}
