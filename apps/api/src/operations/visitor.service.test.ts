import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { VisitorService } from "./visitor.service.js";
import type { VisitorRepository } from "./visitor.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<VisitorRepository>) {
  return new VisitorService(new SecurityPolicyService(), repository as VisitorRepository);
}

describe("VisitorService", () => {
  it("lets a guard log a visitor", async () => {
    const logVisitor = vi.fn().mockResolvedValue({
      logged: true,
      replayed: false,
      visitorId: "visitor_1",
      status: "pending_approval",
    });
    const service = createService({ logVisitor });

    await expect(
      service.logVisitor(principal(["guard"]), {
        societyId: "society_a",
        flatNumber: "A-101",
        visitorName: "Ravi",
        purpose: "delivery",
        arrivedAt: new Date("2026-06-07T10:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ logged: true, visitorId: "visitor_1" });
    expect(logVisitor).toHaveBeenCalledOnce();
  });

  it("blocks a resident from logging a gate visitor", async () => {
    const service = createService({ logVisitor: vi.fn() });

    await expect(
      service.logVisitor(principal(["resident"]), {
        societyId: "society_a",
        flatNumber: "A-101",
        visitorName: "Ravi",
        purpose: "delivery",
        arrivedAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a resident respond to a visitor", async () => {
    const respondToVisitor = vi.fn().mockResolvedValue({
      visitorId: "visitor_1",
      status: "approved",
      action: "approve",
    });
    const service = createService({ respondToVisitor });

    await expect(
      service.respondToVisitor(principal(["resident"]), {
        societyId: "society_a",
        visitorId: "visitor_1",
        decision: "approve",
        respondedAt: new Date(),
      }),
    ).resolves.toMatchObject({ status: "approved" });
  });

  it("blocks a guard from responding on behalf of a resident", async () => {
    const service = createService({ respondToVisitor: vi.fn() });

    await expect(
      service.respondToVisitor(principal(["guard"]), {
        societyId: "society_a",
        visitorId: "visitor_1",
        decision: "approve",
        respondedAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a guard scan a patrol checkpoint", async () => {
    const scanPatrol = vi.fn().mockResolvedValue({
      recorded: true,
      replayed: false,
      patrolId: "patrol_1",
    });
    const service = createService({ scanPatrol });

    await expect(
      service.scanPatrol(principal(["guard"]), {
        societyId: "society_a",
        guardId: "guard_1",
        checkpoint: "Gate A",
        scannedAt: new Date(),
      }),
    ).resolves.toMatchObject({ recorded: true });
  });

  it("lets a guard read the visitor list", async () => {
    const listVisitors = vi.fn().mockResolvedValue([]);
    const service = createService({ listVisitors });

    await expect(service.listVisitors(principal(["guard"]), "society_a")).resolves.toEqual([]);
    expect(listVisitors).toHaveBeenCalledWith("society_a", undefined);
  });
});
