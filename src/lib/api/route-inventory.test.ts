import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getRemovedRoutes, resolveRouteDisposition, ROUTE_DISPOSITIONS } from "./route-disposition.ts";

const API_ROOT = path.join(process.cwd(), "src", "app", "api");

function listRouteFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listRouteFiles(fullPath));
      continue;
    }
    if (entry === "route.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

describe("legacy route inventory", () => {
  it("maps every route file to a disposition entry", () => {
    const routeFiles = listRouteFiles(API_ROOT);
    expect(routeFiles.length).toBeGreaterThan(0);

    for (const file of routeFiles) {
      const disposition = resolveRouteDisposition(file);
      expect(disposition.disposition).toBeTruthy();
    }
  });

  it("marks legal-adviser for removal", () => {
    expect(getRemovedRoutes()).toContain("/api/legal-adviser");
    const entry = ROUTE_DISPOSITIONS.find((item) => item.routePath === "/api/legal-adviser");
    expect(entry?.disposition).toBe("remove");
  });

  it("does not mark removed routes without inventory entries", () => {
    for (const routePath of getRemovedRoutes()) {
      expect(ROUTE_DISPOSITIONS.some((entry) => entry.routePath === routePath)).toBe(true);
    }
  });
});
