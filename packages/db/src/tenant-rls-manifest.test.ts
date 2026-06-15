import { describe, expect, it } from "vitest";
import { TENANT_RLS_TABLES, buildTenantRlsManifestSql } from "./tenant-rls-manifest.ts";

describe("tenant RLS manifest", () => {
  it("covers core Phase 2 society-scoped tables", () => {
    expect(TENANT_RLS_TABLES.map((table) => table.tableName)).toEqual(
      expect.arrayContaining(["Notice", "Document", "ActivityLog", "Notification", "MaintenanceBill"]),
    );
  });

  it("builds a migration-ready SQL manifest", () => {
    const sql = buildTenantRlsManifestSql();

    expect(sql).toContain('ALTER TABLE "Notice" FORCE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;');
  });
});
