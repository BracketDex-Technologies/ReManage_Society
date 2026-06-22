import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("MFA enrollment persistence", () => {
  it("stores an encrypted TOTP secret and enrollment timestamp on users", () => {
    const userModel = schema.match(/model User \{([\s\S]*?)\n\}/)?.[1] ?? "";

    expect(userModel).toMatch(/mfaTotpSecretEncrypted\s+String\?/);
    expect(userModel).toMatch(/mfaEnrolledAt\s+DateTime\?/);
  });
});
