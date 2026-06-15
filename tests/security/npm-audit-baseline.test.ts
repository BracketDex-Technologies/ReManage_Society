import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("npm audit baseline", () => {
  it("documents a frozen vulnerability baseline", () => {
    const baseline = JSON.parse(
      readFileSync(path.join(process.cwd(), "docs/security/audit-baseline.json"), "utf8"),
    );

    expect(baseline.vulnerabilities.critical).toBe(0);
    expect(baseline.vulnerabilities.high).toBeGreaterThan(0);
    expect(baseline.reviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
