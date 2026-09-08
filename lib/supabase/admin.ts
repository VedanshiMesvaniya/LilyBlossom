// Service-role Supabase client. SERVER-ONLY. Bypasses RLS.
//
// Only import this file from:
//   - the crawler's internal API route (app/api/admin/crawler/run)
//   - admin-only route handlers, after the caller's admin role is verified
//
// Never import this from a Client Component, and never send
// SUPABASE_SERVICE_ROLE_KEY to the browser.
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "The admin client must not be created without both."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
