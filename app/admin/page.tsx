import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ count: seriesCount }, { count: movieCount }, { count: airingCount }, { count: upcomingCount }, { count: pendingAnnouncements }] =
    await Promise.all([
      admin.from("titles").select("id", { count: "exact", head: true }).eq("type", "series").eq("is_published", true),
      admin.from("titles").select("id", { count: "exact", head: true }).eq("type", "movie").eq("is_published", true),
      admin.from("titles").select("id", { count: "exact", head: true }).eq("release_status", "Airing"),
      admin.from("titles").select("id", { count: "exact", head: true }).in("release_status", ["Announced", "Upcoming"]),
      admin.from("announcements").select("id", { count: "exact", head: true }).eq("status", "draft")
    ]);

  const stats = [
    ["Series", seriesCount ?? 0],
    ["Movies", movieCount ?? 0],
    ["Currently Airing", airingCount ?? 0],
    ["Upcoming", upcomingCount ?? 0],
    ["Pending Announcements", pendingAnnouncements ?? 0]
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 font-ui">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Admin Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label as string} className="rounded-card border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">{label}</p>
            <p className="mt-1 text-2xl text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <a href="/admin/crawler" className="text-primary hover:text-primary-hover">Crawler status →</a>
        <a href="/admin/review" className="text-primary hover:text-primary-hover">Review queue →</a>
        <a href="/admin/announcements" className="text-primary hover:text-primary-hover">Announcements →</a>
        <a href="/admin/sources" className="text-primary hover:text-primary-hover">Sources →</a>
      </div>
    </div>
  );
}
