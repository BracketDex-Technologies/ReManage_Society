import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("global contrast-border system", () => {
  it("defines strong light and dark border tokens", () => {
    expect(styles).toContain("--color-card-border: #C7C7C7;");
    expect(styles).toContain("--color-control-border: #B0B0B0;");
    expect(styles).toContain("--color-card-border: #5B5B5B;");
    expect(styles).toContain("--color-control-border: #686868;");
    expect(styles).toContain("--dashboard-border: #C7C7C7;");
    expect(styles).toContain("--dashboard-border: #5B5B5B;");
  });

  it("uses a 1.5px, 1rem outline for shared cards and buttons", () => {
    expect(styles).toMatch(/\.btn \{[\s\S]*border-radius: 1rem;[\s\S]*border: 1\.5px solid var\(--color-control-border\);/);
    expect(styles).toMatch(/\.card \{[\s\S]*border-radius: 1rem;[\s\S]*border: 1\.5px solid var\(--color-card-border\);/);
    expect(styles).toContain('main :is(section, article, form, div)[class~="border"][class*="rounded"]');
  });

  it("keeps explicit circular and pill controls rounded", () => {
    expect(styles).toMatch(/button\[class~="rounded-full"\],\s*\[role="button"\]\[class~="rounded-full"\]/);
  });
});
