import { describe, it, expect } from "vitest";
import { generateUniqueUsername, generateUsername } from "../../src/lib/usernameGenerator.js";

describe("usernameGenerator", () => {
  it("returns a name in Adjective+Noun format", () => {
    const username = generateUsername();
    expect(username).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
  });

  it("generateUniqueUsername returns a valid username string for backwards compatibility", async () => {
    const username = await generateUniqueUsername();
    expect(typeof username).toBe("string");
    expect(username).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
  });
});
