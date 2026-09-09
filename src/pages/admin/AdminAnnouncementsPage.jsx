import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";

export function AdminAnnouncementsPage() {
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from("announcements")
      .select("id, title, announcement_type, status, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (isMounted) setDrafts(data ?? []);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-ui">
      <h1 className="mb-6 font-display text-3xl text-text-primary">Announcements</h1>

      {drafts.length === 0 ? (
        <p className="text-text-muted">No announcement drafts yet.</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-card border border-border bg-surface p-4">
              <div>
                <p className="text-text-primary">{item.title}</p>
                <p className="text-xs text-text-muted">
                  {item.announcement_type} · {item.status}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button className="rounded-full border border-border px-3 py-1 hover:border-primary">Edit</button>
                <button className="rounded-full border border-border px-3 py-1 hover:border-primary">
                  {item.status === "published" ? "Unpublish" : "Publish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
