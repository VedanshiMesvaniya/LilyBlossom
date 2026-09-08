import { generateUniqueUsername } from "@/lib/usernameGenerator";

function makeSupabaseStub(existingUsernames: Set<string>) {
  return {
    from: () => ({
      select: () => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () => ({
            data: existingUsernames.has(value) ? { id: "existing" } : null,
            error: null
          })
        })
      })
    })
  } as any;
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
    } as any;

    const username = await generateUniqueUsername(supabase);
    expect(typeof username).toBe("string");
    expect(calls).toBeGreaterThanOrEqual(3);
  });
});
