import { describe, expect, it } from "vitest";
import { resolveTenantContext } from "./tenant-context.ts";
import type { AuthenticatedPrincipal } from "./types.ts";

const principal: AuthenticatedPrincipal = {
  subject: "user_123",
  memberships: [
    {
      societyId: "society_a",
      roles: ["committee"],
      mfaVerified: true,
    },
  ],
  platformRoles: [],
};

describe("resolveTenantContext", () => {
  it("blocks a normal member from switching to a society they do not belong to", () => {
    expect(() => resolveTenantContext(principal, "society_b")).toThrow(
      "Principal user_123 is not a member of society society_b",
    );
  });

  it("allows platform admins to select any society while preserving audit identity", () => {
    const context = resolveTenantContext(
      {
        subject: "platform_admin",
        memberships: [],
        platformRoles: ["platform_admin"],
      },
      "society_b",
    );

    expect(context).toEqual({
      actorId: "platform_admin",
      societyId: "society_b",
      roles: ["platform_admin"],
      mfaVerified: false,
      source: "platform-admin-override",
    });
  });
});
