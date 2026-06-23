import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const membershipMigrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260623220000_society_membership_auth/migration.sql",
);

describe("authentication schema contract", () => {
  it("defines an active user flag and society membership lifecycle record", () => {
    expect(schema).toContain("isActive             Boolean  @default(true)");
    expect(schema).toContain("model SocietyMembership {");
    expect(schema).toContain("permissionRole       String");
    expect(schema).toContain("status               String   @default(\"pending\")");
    expect(schema).toContain("@@unique([userId, societyId])");
  });
});

describe("society membership migration", () => {
  it("backfills legacy society users as active memberships", () => {
    const migration = readFileSync(membershipMigrationPath, "utf8");

    expect(migration).toMatch(/ALTER TABLE "User"\s+ADD COLUMN IF NOT EXISTS "isActive"/);
    expect(migration).toContain('CREATE TABLE "SocietyMembership"');
    expect(migration).toContain('INSERT INTO "SocietyMembership"');
    expect(migration).toContain('WHERE u."societyId" IS NOT NULL');
    expect(migration).toContain('ON CONFLICT ("userId", "societyId") DO NOTHING');
  });
});
