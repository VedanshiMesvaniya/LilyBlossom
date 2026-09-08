// Shared design and product constants.
// Keep this file as the single source of truth so copy and colors
// used outside Tailwind (emails, SVGs, meta tags) stay in sync.

export const PRODUCT_NAME = "GL Tracker";
export const PRODUCT_OWNER = "Vedu";
export const SUPPORT_EMAIL = "support@gltracker.app";

export const CURRENT_YEAR = new Date().getFullYear();

export const COPYRIGHT_LINE = `© ${CURRENT_YEAR} ${PRODUCT_OWNER} - ${PRODUCT_NAME}`;

export const BRAND_COLORS = {
  background: "#FFF8F8",
  surface: "#FFFFFF",
  creamSurface: "#FFFDF5",
  primary: "#FF99B0",
  primaryHover: "#FF7D9A",
  secondary: "#E9D5FF",
  textPrimary: "#2F3E34",
  textMuted: "#64748B",
  softBorder: "rgba(255,153,176,0.15)",
  progressBackground: "#FEE2E2",
  dark: {
    background: "#140E12",
    surface: "#20161C",
    primary: "#FFAEC1",
    text: "#FAFAFA"
  }
} as const;

export type WatchStatus = "plan_to_watch" | "watching" | "watched" | "dropped";

export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  plan_to_watch: "Plan to Watch",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped"
};
