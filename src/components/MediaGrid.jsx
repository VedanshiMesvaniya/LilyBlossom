import { MediaCard } from "./MediaCard.jsx";

export function MediaGrid({ items, emptyLabel }) {
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
