import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  generateTotpToken,
  requiresMfa,
  resolveMfaLoginRequirement,
  verifyTotpToken,
} from "./totp.ts";

describe("TOTP MFA", () => {
  const originalKey = process.env.MFA_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.MFA_ENCRYPTION_KEY = "test-only-mfa-encryption-key-with-adequate-length";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = originalKey;
  });

  it("encrypts and decrypts a generated TOTP secret", () => {
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
  });

  it("accepts a current TOTP code and rejects an invalid one", () => {
    const secret = generateTotpSecret();

    expect(verifyTotpToken(secret, generateTotpToken(secret))).toBe(true);
    expect(verifyTotpToken(secret, "000000")).toBe(false);
  });

  it.each(["chairman", "secretary", "treasurer", "facility_manager"])(
    "requires MFA for %s",
    (role) => expect(requiresMfa(role)).toBe(true),
  );

  it.each(["member", "tenant", "guard", "watchman", "vendor_staff"])(
    "does not require MFA for %s",
    (role) => expect(requiresMfa(role)).toBe(false),
  );

  it("requires enrollment before a privileged user can receive a verified session", () => {
    expect(resolveMfaLoginRequirement("chairman", null, null)).toBe("enrollment_required");
    expect(resolveMfaLoginRequirement("chairman", "encrypted-secret", null)).toBe("enrollment_required");
    expect(resolveMfaLoginRequirement("chairman", "encrypted-secret", new Date())).toBe("verification_required");
  });

  it("does not challenge roles without MFA-protected actions", () => {
    expect(resolveMfaLoginRequirement("member", null, null)).toBe("not_required");
  });
});
