import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({ profile });
}
