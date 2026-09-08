import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function AnnouncementDetailPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: announcement } = await supabase
    .from("announcements")
    .select("*")
    .eq("slug", params.slug)
    .eq("status", "published")
    .single();

  if (!announcement) notFound();

  return (
    <article className="mx-auto max-w-2xl px-4 py-10 font-ui">
      <p className="text-xs text-primary">{announcement.announcement_type}</p>
      <h1 className="mt-1 font-display text-3xl text-text-primary">{announcement.title}</h1>
      <p className="mt-1 text-xs text-text-muted">{announcement.published_at}</p>

      {announcement.cover_image && (
        <div className="relative mt-6 aspect-video overflow-hidden rounded-card">
          <Image src={announcement.cover_image} alt={announcement.title} fill className="object-cover" />
        </div>
      )}

      <div className="mt-6 whitespace-pre-line text-text-primary">{announcement.content}</div>

      {announcement.source_url && (
        <p className="mt-6 text-sm text-text-muted">
          Source:{" "}
          <a href={announcement.source_url} className="text-primary hover:text-primary-hover">
            {announcement.source_name ?? "Original source"}
          </a>
        </p>
      )}
    </article>
  );
}
