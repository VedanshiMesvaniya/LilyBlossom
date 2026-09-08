"use client";

export type FilterState = {
  year?: string;
  country?: string;
  language?: string;
  releaseStatus?: string;
  personalStatus?: string;
  sort?: string;
};

const SORT_OPTIONS = ["Newest", "Oldest", "A-Z", "Recently Updated"];

/**
 * Presentational filter bar. Owns no fetching logic; the parent page
 * reads the URL search params and re-queries the API/database.
 */
export function Filters({
  value,
  onChange,
  releaseStatusOptions
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  releaseStatusOptions: string[];
}) {
  return (
    <div className="flex flex-wrap gap-3 font-ui text-sm">
      <select
        className="rounded-full border border-border bg-surface px-3 py-1.5"
        value={value.releaseStatus ?? ""}
        onChange={(e) => onChange({ ...value, releaseStatus: e.target.value || undefined })}
      >
        <option value="">All statuses</option>
        {releaseStatusOptions.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      <select
        className="rounded-full border border-border bg-surface px-3 py-1.5"
        value={value.sort ?? "Newest"}
        onChange={(e) => onChange({ ...value, sort: e.target.value })}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
