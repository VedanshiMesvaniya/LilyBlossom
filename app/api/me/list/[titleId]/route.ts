import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";

const VALID_STATUSES = ["plan_to_watch", "watching", "watched", "dropped"];

// PUT /api/me/list/:titleId  { status, currentEpisode?, progress? }
// This is the ONLY place personal watch state is written. It never
// touches the shared titles row (see docs/DATABASE.md).
export async function PUT(request: Request, { params }: { params: { titleId: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase.from("user_media_status").upsert(
    {
      user_id: profile.id,
      title_id: params.titleId,
      status: body.status,
      current_episode: body.currentEpisode ?? null,
      progress: body.progress ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,title_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { titleId: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = createClient();
  const { error } = await supabase
    .from("user_media_status")
    .delete()
    .eq("user_id", profile.id)
    .eq("title_id", params.titleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
