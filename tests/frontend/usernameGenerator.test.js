import { describe, it, expect } from "vitest";
import { generateUniqueUsername } from "../../src/lib/usernameGenerator.js";

function makeSupabaseStub(existingUsernames) {
  return {
    from: () => ({
      select: () => ({
        eq: (_col, value) => ({
          maybeSingle: async () => ({
            data: existingUsernames.has(value) ? { id: "existing" } : null,
            error: null
          })
        })
      })
    })
  };
}

describe("generateUniqueUsername", () => {
  it("returns a name in Adjective+Noun format", async () => {
    const supabase = makeSupabaseStub(new Set());
    const username = await generateUniqueUsername(supabase);
    expect(username).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
  });

  it("retries when the first candidates collide", async () => {
    // Force every candidate to look taken except we still expect a
    // string back within maxAttempts.
    let calls = 0;
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              calls += 1;
              return { data: calls < 3 ? { id: "taken" } : null, error: null };
            }
          })
        })
      })
    };

    const username = await generateUniqueUsername(supabase);
    expect(typeof username).toBe("string");
    expect(calls).toBeGreaterThanOrEqual(3);
  });
});
