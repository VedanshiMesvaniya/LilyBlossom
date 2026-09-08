import { createClient } from "@/lib/supabase/server";
import { AnnouncementCard } from "@/components/AnnouncementCard";

export default async function AnnouncementsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("announcements")
    .select("slug, title, summary, cover_image, published_at, announcement_type")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const items = data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text-primary">GL Announcements</h1>

      {items.length === 0 ? (
        <p className="font-ui text-text-muted">No announcements published yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <AnnouncementCard
              key={item.slug}
              item={{
                slug: item.slug,
                title: item.title,
                summary: item.summary,
                coverImage: item.cover_image,
                publishedAt: item.published_at,
                announcementType: item.announcement_type
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
