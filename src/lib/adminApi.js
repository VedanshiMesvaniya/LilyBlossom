import { supabase } from "./supabaseClient.js";
import { API_URL } from "./constants.js";

/**
 * Calls the FastAPI backend (crawler/worker.py) with the current
 * admin's Supabase access token attached. Throws an Error with the
 * backend's own detail message on a non-2xx response, so callers can
 * show a real reason instead of a generic "failed, try again".
 */
export async function adminFetch(path, options = {}) {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      ...(options.headers ?? {})
    }
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.detail ?? `Request failed (${response.status}).`);
  }

  return body;
}
