import { describe, expect, it } from "vitest";
import {
  filterComplaintsByScope,
  normalizeFlatKey,
  type ComplaintListScope,
} from "./list-scope";

describe("normalizeFlatKey", () => {
  it("ignores case, spaces, and dashes", () => {
    expect(normalizeFlatKey("A-101")).toBe(normalizeFlatKey("a 101"));
    expect(normalizeFlatKey("B-202")).toBe("B202");
  });
});

describe("filterComplaintsByScope", () => {
  const rows = [
    { flatNumber: "A-101", raisedBy: "Ravi", title: "a" },
    { flatNumber: "B-202", raisedBy: "Meera", title: "b" },
    { flatNumber: "a101", raisedBy: "Ravi", title: "c" },
  ];

  it("returns all rows for committee scope", () => {
    expect(filterComplaintsByScope(rows, { kind: "all" })).toHaveLength(3);
  });

  it("returns no rows when flat is not linked", () => {
    expect(filterComplaintsByScope(rows, { kind: "none", reason: "no_flat" })).toHaveLength(0);
  });

  it("matches flat variants for resident scope", () => {
    const scope: ComplaintListScope = { kind: "flat", flatNumber: "A-101", flatKey: normalizeFlatKey("A-101") };
    const filtered = filterComplaintsByScope(rows, scope);
    expect(filtered.map((r) => r.title)).toEqual(["a", "c"]);
  });

  it("filters gate staff complaints by raisedBy", () => {
    const scope: ComplaintListScope = { kind: "raisedBy", raisedBy: "Meera" };
    expect(filterComplaintsByScope(rows, scope)).toEqual([rows[1]]);
  });
});
