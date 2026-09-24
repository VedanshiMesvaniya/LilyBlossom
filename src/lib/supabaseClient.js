// Single browser Supabase client for the whole app.
// Auth and every read shown to a signed-in user go through this
// client so Row Level Security (see supabase/migrations/009_rls.sql)
// is always the thing enforcing access, never app code alone.
import { createClient } from "@supabase/supabase-js";
import { looksLikeSupabaseUrl, normalizeSupabaseUrl } from "./connectionErrors.js";

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Loud but non-fatal: pages that do not need Supabase (like a
  // static help page) can still render while this gets fixed.
  console.warn(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. " +
      "Copy .env.example to .env and fill in your Supabase project values."
  );
}

if (supabaseUrl && !looksLikeSupabaseUrl(supabaseUrl)) {
  console.warn(
    `VITE_SUPABASE_URL is "${supabaseUrl}", which does not look like https://<project>.supabase.co. ` +
      "If every request shows 'Failed to fetch', copy the Project URL again from " +
      "Supabase, Project Settings, API."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
