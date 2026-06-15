import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { AssetService } from "./asset.service.js";
import type { AssetRepository } from "./asset.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<AssetRepository>) {
  return new AssetService(new SecurityPolicyService(), repository as AssetRepository);
}

describe("AssetService", () => {
  it("requires MFA management to create a vendor", async () => {
    const createVendor = vi.fn().mockResolvedValue({ created: true, vendorId: "v1" });
    const service = createService({ createVendor });

    await expect(
      service.createVendor(principal(["society_admin"], true), {
        societyId: "society_a",
        name: "LiftCo",
        category: "lift",
      }),
    ).resolves.toMatchObject({ created: true });
  });

  it("blocks vendor creation without MFA", async () => {
    const service = createService({ createVendor: vi.fn() });
    await expect(
      service.createVendor(principal(["committee"], false), {
        societyId: "society_a",
        name: "LiftCo",
        category: "lift",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a resident read due maintenance", async () => {
    const listDueMaintenance = vi.fn().mockResolvedValue([]);
    const service = createService({ listDueMaintenance });
    await expect(service.listDueMaintenance(principal(["resident"]), "society_a")).resolves.toEqual([]);
  });
});
