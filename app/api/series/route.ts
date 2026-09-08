import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTitlesByType } from "@/lib/catalog/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = createClient();
  const items = await getTitlesByType(supabase, "series", {
    year: searchParams.get("year") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    releaseStatus: searchParams.get("releaseStatus") ?? undefined
  });
  return NextResponse.json({ series: items });
}
