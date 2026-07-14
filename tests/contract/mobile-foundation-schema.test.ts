import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260713090000_mobile_foundation/migration.sql",
  "utf8",
);

describe("mobile foundation schema", () => {
  it("separates native sessions from legacy browser sessions", () => {
    expect(schema).toContain("model MobileDeviceSession");
    expect(schema).toContain("refreshTokenHash");
    expect(schema).toContain("model MobileOtpChallenge");
    expect(schema).toContain("model SocietyRoleAssignment");
    expect(schema).toContain("@@index([userId, societyId, installationId, revokedAt])");
    expect(migration).toContain("MobileDeviceSession_one_active_installation_idx");
    expect(schema).not.toContain("renewableCredential String");
  });

  it("backfills only the two approved mobile personas", () => {
    expect(migration).toContain("'resident'");
    expect(migration).toContain("'guard'");
    expect(migration).toContain("ON CONFLICT DO NOTHING");
  });
});
