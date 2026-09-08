// Loading placeholder so a grid never shows a blank white screen while
// data streams in.
export function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-card border border-border bg-surface">
      <div className="aspect-[2/3] w-full bg-secondary/60" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-3/4 rounded bg-secondary/60" />
        <div className="h-3 w-1/2 rounded bg-secondary/60" />
      </div>
    </div>
  );
}
