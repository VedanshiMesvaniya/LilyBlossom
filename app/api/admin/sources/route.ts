import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("sources").select("*").order("priority", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data });
}

// PATCH /api/admin/sources  { id, enabled }
export async function PATCH(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing source id." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sources")
    .update({ enabled: body.enabled })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}
