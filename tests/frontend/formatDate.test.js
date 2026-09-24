import { describe, expect, it } from "vitest";
import { formatReleaseDate } from "../../src/lib/formatDate.js";

describe("formatReleaseDate", () => {
  it("formats a full date without shifting the day", () => {
    expect(formatReleaseDate("2020-05-01")).toBe("May 1, 2020");
    expect(formatReleaseDate("2019-12-31")).toBe("December 31, 2019");
  });

  it("returns null for missing or invalid values", () => {
    expect(formatReleaseDate(null)).toBeNull();
    expect(formatReleaseDate("")).toBeNull();
    expect(formatReleaseDate("2020")).toBeNull();
    expect(formatReleaseDate("2020-13-45")).toBeNull();
  });
});
