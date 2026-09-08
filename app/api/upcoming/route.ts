import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("is_published", true)
    .in("release_status", ["Announced", "In Production", "Upcoming"])
    .order("release_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ upcoming: data });
}
