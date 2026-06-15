import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { MarketplaceService } from "./marketplace.service.js";
import type { MarketplaceRepository } from "./marketplace.repository.js";

function principal(roles: string[]): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified: false }],
    platformRoles: [],
  };
}

function createService(repository: Partial<MarketplaceRepository>) {
  return new MarketplaceService(new SecurityPolicyService(), repository as MarketplaceRepository);
}

describe("MarketplaceService", () => {
  it("lets a resident create a listing", async () => {
    const service = createService({ createListing: vi.fn().mockResolvedValue({ created: true }) });

    await expect(
      service.createListing(principal(["resident"]), {
        societyId: "society_a",
        userId: "u1",
        title: "Sofa",
      }),
    ).resolves.toMatchObject({ created: true });
  });

  it("forbids a resident from moderating listings", async () => {
    const service = createService({ moderateListing: vi.fn() });

    await expect(
      service.moderateListing(principal(["resident"]), {
        societyId: "society_a",
        listingId: "listing_1",
        action: "reject",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("computes verified-resident and manager visibility for listing reads", async () => {
    const listListings = vi.fn().mockResolvedValue([]);
    const service = createService({ listListings });

    await service.listListings(principal(["committee"]), { societyId: "society_a", userId: "c1" });
    expect(listListings).toHaveBeenCalledWith(
      "society_a",
      expect.objectContaining({ isManager: true, isVerifiedResident: true }),
      undefined,
    );

    listListings.mockClear();
    await service.listListings(principal(["guard"]), { societyId: "society_a", userId: "g1" });
    expect(listListings).toHaveBeenCalledWith(
      "society_a",
      expect.objectContaining({ isManager: false, isVerifiedResident: false }),
      undefined,
    );
  });
});
