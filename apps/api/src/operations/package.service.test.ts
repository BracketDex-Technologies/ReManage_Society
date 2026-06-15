import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { NotificationFoundationService } from "../security/notification-foundation.service.js";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { PackageService } from "./package.service.js";
import type { PackageRepository } from "./package.repository.js";

function principal(roles: string[]): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified: false }],
    platformRoles: [],
  };
}

function createService(repository: Partial<PackageRepository>) {
  return new PackageService(
    new SecurityPolicyService(),
    new NotificationFoundationService({ now: () => "2026-06-07T11:05:00.000Z" }),
    repository as PackageRepository,
  );
}

describe("PackageService", () => {
  it("lets a guard intake a package", async () => {
    const intakePackage = vi
      .fn()
      .mockResolvedValue({ logged: true, replayed: false, packageId: "package_1", status: "received" });
    const service = createService({ intakePackage });

    await expect(
      service.intakePackage(principal(["guard"]), {
        societyId: "society_a",
        flatId: "flat_1",
        loggedBy: "guard_1",
        receivedAt: new Date(),
      }),
    ).resolves.toMatchObject({ logged: true });
  });

  it("emits a notification envelope when notifying a package", async () => {
    const notifyPackage = vi.fn().mockResolvedValue({ packageId: "package_1", status: "notified" });
    const service = createService({ notifyPackage });

    const result = await service.notifyPackage(principal(["guard"]), {
      societyId: "society_a",
      packageId: "package_1",
      flatId: "flat_1",
      notifiedAt: new Date(),
    });

    expect(result).toMatchObject({ status: "notified" });
    expect(result.notification).toMatchObject({
      queue: "notifications",
      template: "package-arrived",
      idempotencyKey: "society_a:flat_1:push:package-arrived:package_1",
    });
  });

  it("blocks residents from gate package actions", async () => {
    const service = createService({ intakePackage: vi.fn() });

    await expect(
      service.intakePackage(principal(["resident"]), {
        societyId: "society_a",
        flatId: "flat_1",
        loggedBy: "x",
        receivedAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
