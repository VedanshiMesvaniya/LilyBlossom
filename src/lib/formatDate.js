// Formats a plain date string from the database (YYYY-MM-DD) for display.
// The time is pinned to local midnight so the day never shifts by a
// timezone offset. Returns null for a missing or invalid date.
export function formatReleaseDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
