import Image from "next/image";
import Link from "next/link";

export type AnnouncementCardData = {
  slug: string;
  title: string;
  summary: string;
  coverImage: string | null;
  publishedAt: string;
  announcementType: string;
};

export function AnnouncementCard({ item }: { item: AnnouncementCardData }) {
  return (
    <Link
      href={`/announcements/${item.slug}`}
      className="grid gap-4 overflow-hidden rounded-card border border-border bg-surface p-4 transition hover:shadow-md sm:grid-cols-[160px_1fr]"
    >
      <div className="relative aspect-video overflow-hidden rounded-card bg-secondary sm:aspect-[3/4]">
        {item.coverImage && <Image src={item.coverImage} alt={item.title} fill className="object-cover" />}
      </div>

      <div className="font-ui">
        <p className="text-xs text-primary">{item.announcementType}</p>
        <h3 className="mt-1 font-display text-lg text-text-primary">{item.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-text-muted">{item.summary}</p>
        <p className="mt-3 text-xs text-text-muted">{item.publishedAt}</p>
      </div>
    </Link>
  );
}
