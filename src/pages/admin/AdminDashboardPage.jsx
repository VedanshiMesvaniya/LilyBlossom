import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";

// Reads go straight through the browser Supabase client. This is safe
// for an admin because is_admin() in the RLS policies (see
// supabase/migrations/009_rls.sql) already opens up these reads to an
// authenticated admin; no service-role backend call is needed here.
export function AdminDashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [series, movies, airing, upcoming, pendingAnnouncements] = await Promise.all([
        supabase.from("titles").select("id", { count: "exact", head: true }).eq("type", "series").eq("is_published", true),
        supabase.from("titles").select("id", { count: "exact", head: true }).eq("type", "movie").eq("is_published", true),
        supabase.from("titles").select("id", { count: "exact", head: true }).eq("release_status", "Airing"),
        supabase.from("titles").select("id", { count: "exact", head: true }).in("release_status", ["Announced", "Upcoming"]),
        supabase.from("announcements").select("id", { count: "exact", head: true }).eq("status", "draft")
      ]);

      if (!isMounted) return;
      setStats([
        ["Series", series.count ?? 0],
        ["Movies", movies.count ?? 0],
        ["Currently Airing", airing.count ?? 0],
        ["Upcoming", upcoming.count ?? 0],
        ["Pending Announcements", pendingAnnouncements.count ?? 0]
      ]);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 font-ui">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Admin Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(stats ?? []).map(([label, value]) => (
          <div key={label} className="rounded-card border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">{label}</p>
            <p className="mt-1 text-2xl text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link to="/admin/crawler" className="text-primary hover:text-primary-hover">Crawler status →</Link>
        <Link to="/admin/review" className="text-primary hover:text-primary-hover">Review queue →</Link>
        <Link to="/admin/announcements" className="text-primary hover:text-primary-hover">Announcements →</Link>
        <Link to="/admin/sources" className="text-primary hover:text-primary-hover">Sources →</Link>
      </div>
    </div>
  );
}
