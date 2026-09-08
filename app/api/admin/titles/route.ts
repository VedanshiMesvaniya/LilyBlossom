import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/admin/titles  { id, ...fields }
// The only write path for global catalog edits made directly by a
// human admin (as opposed to the crawler pipeline).
export async function PATCH(request: Request) {
  const admin_profile = await requireAdmin();
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing title id." }, { status: 400 });

  const { id, ...fields } = body;
  const admin = createAdminClient();

  const { data: before } = await admin.from("titles").select("*").eq("id", id).single();
  const { data: updated, error } = await admin
    .from("titles")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_actions").insert({
    admin_id: admin_profile.id,
    action: "edit",
    entity_type: "title",
    entity_id: id,
    old_value: before,
    new_value: updated
  });

  return NextResponse.json({ title: updated });
}
