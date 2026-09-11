import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "../../src/lib/sanitizeNextPath.js";

describe("sanitizeNextPath", () => {
  it("defaults missing or empty values to the home page", () => {
    expect(sanitizeNextPath(null)).toBe("/");
    expect(sanitizeNextPath(undefined)).toBe("/");
    expect(sanitizeNextPath("")).toBe("/");
  });

  it("accepts a genuine relative path", () => {
    expect(sanitizeNextPath("/my-list")).toBe("/my-list");
    expect(sanitizeNextPath("/series/some-show?tab=info")).toBe("/series/some-show?tab=info");
  });

  it("rejects an absolute URL", () => {
    expect(sanitizeNextPath("https://evil.example")).toBe("/");
    expect(sanitizeNextPath("http://evil.example/phish")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(sanitizeNextPath("//evil.example")).toBe("/");
  });

  it("rejects backslash tricks browsers can normalize to a protocol-relative URL", () => {
    expect(sanitizeNextPath("/\\evil.example")).toBe("/");
    expect(sanitizeNextPath("\\\\evil.example")).toBe("/");
  });

  it("rejects a value that does not start with a single slash", () => {
    expect(sanitizeNextPath("evil.example")).toBe("/");
  });
});
