import { describe, expect, it } from "vitest";
import { buildTenantRlsPolicySql } from "./rls-policy.ts";

describe("buildTenantRlsPolicySql", () => {
  it("generates force-enabled tenant isolation SQL for a society-scoped table", () => {
    expect(buildTenantRlsPolicySql({ tableName: "Notice", societyColumn: "societyId" })).toContain(
      'ALTER TABLE "Notice" FORCE ROW LEVEL SECURITY;',
    );
    expect(buildTenantRlsPolicySql({ tableName: "Notice", societyColumn: "societyId" })).toContain(
      `"societyId" = current_setting('app.current_society_id', true)`,
    );
  });
});
