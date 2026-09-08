import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/admin/announcements  { id, status: "published" | "draft" | "unpublished" }
export async function PATCH(request: Request) {
  const admin_profile = await requireAdmin();
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: "Missing id or status." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("announcements")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_actions").insert({
    admin_id: admin_profile.id,
    action: body.status === "published" ? "publish" : "unpublish",
    entity_type: "announcement",
    entity_id: body.id,
    new_value: updated
  });

  return NextResponse.json({ announcement: updated });
}
