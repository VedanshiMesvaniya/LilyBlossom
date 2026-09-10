// Shared design and product constants.
// Keep this file as the single source of truth so copy and colors
// used outside Tailwind (meta tags, favicon, emails) stay in sync.

export const PRODUCT_NAME = "LilyBlossom";
export const PRODUCT_OWNER = "Vedanshi Mesvaniya";
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "vedanshimesvaniya@gmail.com";

export const CURRENT_YEAR = new Date().getFullYear();

export const COPYRIGHT_LINE = `© ${CURRENT_YEAR} ${PRODUCT_OWNER}, ${PRODUCT_NAME}`;

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
};

export const WATCH_STATUSES = ["plan_to_watch", "watching", "watched", "dropped"];

export const WATCH_STATUS_LABELS = {
  plan_to_watch: "Plan to Watch",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped"
};

// Local Python backend, used only for admin actions and the crawler
// trigger. Every other read and write in the app goes straight to
// Supabase from the browser. See crawler/worker.py.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";
