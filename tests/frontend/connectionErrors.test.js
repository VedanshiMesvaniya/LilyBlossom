import { describe, expect, it } from "vitest";
import {
  friendlyErrorMessage,
  isNetworkError,
  looksLikeSupabaseUrl,
  normalizeSupabaseUrl
} from "../../src/lib/connectionErrors.js";

describe("normalizeSupabaseUrl", () => {
  it("leaves a clean project URL alone", () => {
    expect(normalizeSupabaseUrl("https://abc123.supabase.co")).toBe("https://abc123.supabase.co");
  });

  it("removes spaces, quotes, trailing slashes and pasted API paths", () => {
    expect(normalizeSupabaseUrl('  "https://abc123.supabase.co/"  ')).toBe("https://abc123.supabase.co");
    expect(normalizeSupabaseUrl("https://abc123.supabase.co/rest/v1")).toBe("https://abc123.supabase.co");
    expect(normalizeSupabaseUrl("https://abc123.supabase.co/auth/v1/")).toBe("https://abc123.supabase.co");
  });

  it("passes empty values through", () => {
    expect(normalizeSupabaseUrl(undefined)).toBeUndefined();
    expect(normalizeSupabaseUrl("")).toBe("");
  });
});

describe("looksLikeSupabaseUrl", () => {
  it("accepts a project URL and rejects other shapes", () => {
    expect(looksLikeSupabaseUrl("https://abc123.supabase.co")).toBe(true);
    expect(looksLikeSupabaseUrl("https://supabase.com/dashboard/project/abc123")).toBe(false);
    expect(looksLikeSupabaseUrl("http://localhost:5173")).toBe(false);
    expect(looksLikeSupabaseUrl(undefined)).toBe(false);
  });
});

describe("friendlyErrorMessage", () => {
  it("explains a network failure", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(friendlyErrorMessage(new TypeError("Failed to fetch"))).toMatch(/VITE_SUPABASE_URL/);
    expect(friendlyErrorMessage("TypeError: Failed to fetch")).toMatch(/Restart npm run dev/);
  });

  it("returns other messages unchanged and null for no error", () => {
    expect(friendlyErrorMessage({ message: "Invalid login credentials" })).toBe("Invalid login credentials");
    expect(friendlyErrorMessage(null)).toBeNull();
  });
});
