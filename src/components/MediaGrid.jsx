import { MediaCard } from "./MediaCard.jsx";
import { SkeletonCard } from "./SkeletonCard.jsx";

const SKELETON_COUNT = 10;

/**
 * items: the loaded rows, ignored while `loading` is true.
 * loading: shows a skeleton grid instead of items or the empty label,
 *   so a slow connection shows placeholders, not a blank flash of the
 *   empty state.
 * error: a message string. Takes over from everything else, since a
 *   failed query is not the same thing as "there is nothing here" and
 *   the two used to look identical.
 */
export function MediaGrid({ items, emptyLabel, loading = false, error = null }) {
  if (error) {
    return (
      <p className="py-12 text-center font-ui text-sm text-red-500">
        Could not load this list: {error}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="py-12 text-center font-ui text-text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <MediaCard key={item.slug} item={item} />
      ))}
    </div>
  );
}
