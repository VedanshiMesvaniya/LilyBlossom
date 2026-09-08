import Image from "next/image";
import Link from "next/link";
import { ProgressBar } from "./ProgressBar";
import { WATCH_STATUS_LABELS, type WatchStatus } from "@/lib/constants";

export type MediaCardData = {
  slug: string;
  type: "series" | "movie";
  title: string;
  year: number | null;
  country: string | null;
  posterUrl: string | null;
  releaseStatus: string;
  userStatus?: WatchStatus | null;
  progressPercentage?: number | null;
};

/**
 * Deliberately minimal, per the "do not overload cards" rule: poster,
 * release badge, title, year, country, type, personal status, progress,
 * and a details link. Nothing else lives here.
 */
export function MediaCard({ item }: { item: MediaCardData }) {
  const href = item.type === "series" ? `/series/${item.slug}` : `/movies/${item.slug}`;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-card border border-border bg-surface transition hover:shadow-md"
    >
      <div className="relative aspect-[2/3] w-full bg-secondary">
        {item.posterUrl ? (
          <Image src={item.posterUrl} alt={item.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center font-ui text-xs text-text-muted">
            No poster yet
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 font-ui text-[11px] text-text-primary">
          {item.releaseStatus}
        </span>
      </div>

      <div className="space-y-1 p-3 font-ui">
        <p className="line-clamp-1 text-sm text-text-primary">{item.title}</p>
        <p className="text-xs text-text-muted">
          {[item.year, item.country, item.type === "series" ? "Series" : "Movie"]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {item.userStatus && (
          <p className="text-xs text-primary">{WATCH_STATUS_LABELS[item.userStatus]}</p>
        )}

        {typeof item.progressPercentage === "number" && (
          <ProgressBar percentage={item.progressPercentage} />
        )}
      </div>
    </Link>
  );
}
