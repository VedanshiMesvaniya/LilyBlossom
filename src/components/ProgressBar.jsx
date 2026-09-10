export function ProgressBar({ percentage }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-progress-bg"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}
