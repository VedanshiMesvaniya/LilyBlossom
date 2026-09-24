// Helpers for the "Failed to fetch" case, which is what the browser
// reports when it cannot reach Supabase at all (wrong project URL,
// paused project, a network or DNS block, or an old .env that Vite
// has not reloaded). Kept free of import.meta so it can be unit tested.

const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|load failed|network request failed/i;

/**
 * Cleans a Supabase project URL from .env: trims spaces and quotes,
 * removes trailing slashes, and removes a pasted API path such as
 * /rest/v1 so the client always gets the bare project URL.
 */
export function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  return String(rawUrl)
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage|functions|realtime)\/v1$/, "");
}

/** True when the URL looks like https://<project>.supabase.co */
export function looksLikeSupabaseUrl(url) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url ?? "");
}

export function isNetworkError(error) {
  const message = typeof error === "string" ? error : error?.message;
  return NETWORK_ERROR_PATTERN.test(message ?? "");
}

/**
 * Turns a raw network error into a message that says what to check.
 * Any other error message is returned unchanged.
 */
export function friendlyErrorMessage(error) {
  if (!error) return null;
  const message = typeof error === "string" ? error : error.message;
  if (isNetworkError(message)) {
    return (
      "Could not reach the database. Check that VITE_SUPABASE_URL in .env is the exact " +
      "Project URL, that the Supabase project is not paused, and that your network or DNS " +
      "is not blocking supabase.co. Restart npm run dev after changing .env."
    );
  }
  return message;
}
