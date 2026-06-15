import { describe, expect, it } from "vitest";
import { mergeCommandResults, scoreMatch } from "./search-merge.ts";

describe("scoreMatch", () => {
  it("prefers exact matches", () => {
    expect(scoreMatch("Pay bill", "pay bill")).toBe(100);
    expect(scoreMatch("My Bills", "my")).toBe(80);
  });
});

describe("mergeCommandResults", () => {
  it("merges nav, actions, and API hits for residents", () => {
    const results = mergeCommandResults(
      "bill",
      [{ href: "/my-bills", label: "My Bills" }],
      [{ id: "pay-bill", label: "Pay bill", href: "/my-bills" }],
      [{ type: "invoice", title: "Maintenance April", href: "/my-bills" }],
      "resident",
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((item) => item.href === "/my-bills")).toBe(true);
  });

  it("drops sensitive directory rows for residents", () => {
    const results = mergeCommandResults(
      "999",
      [],
      [],
      [{ type: "directory", title: "A-101", subtitle: "9999999999", href: "/directory", sensitive: true }],
      "resident",
    );

    expect(results).toEqual([]);
  });
});
