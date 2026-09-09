import { Link } from "react-router-dom";

// item shape: { slug, title, summary, coverImage, publishedAt, announcementType }
export function AnnouncementCard({ item }) {
  return (
    <Link
      to={`/announcements/${item.slug}`}
      className="grid gap-4 overflow-hidden rounded-card border border-border bg-surface p-4 transition hover:shadow-md sm:grid-cols-[160px_1fr]"
    >
      <div className="relative aspect-video overflow-hidden rounded-card bg-secondary sm:aspect-[3/4]">
        {item.coverImage && (
          <img src={item.coverImage} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
        )}
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
