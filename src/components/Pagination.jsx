/**
 * Simple Prev/Next + page count control. Deliberately not a full page
 * number picker: with a growing catalog the exact page count matters
 * less than being able to move forward and back without ever loading
 * every title at once (see ARCHITECTURE.md, "Home page needs
 * pagination/limits strategy").
 */
export function Pagination({ page, pageSize, count, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 flex items-center justify-center gap-4 font-ui text-sm">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-full border border-border px-4 py-1.5 text-text-primary hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-text-muted">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-full border border-border px-4 py-1.5 text-text-primary hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
