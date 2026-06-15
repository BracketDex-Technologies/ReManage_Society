import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { AuthenticatedApiRequest } from "../security/authentication.guard.ts";
import { VisitorController } from "./visitor.controller.ts";
import type { VisitorService } from "./visitor.service.ts";

const request: AuthenticatedApiRequest = {
  headers: {},
  principal: {
    subject: "guard_1",
    memberships: [{ societyId: "society_a", roles: ["guard"], mfaVerified: false }],
    platformRoles: [],
  },
};

describe("VisitorController", () => {
  it("parses dates and logs a visitor through the authenticated principal", async () => {
    let captured: { arrivedAt: Date } | undefined;
    const controller = new VisitorController({
      logVisitor: async (_principal: unknown, command: { arrivedAt: Date }) => {
        captured = command;
        return { logged: true, replayed: false, visitorId: "visitor_1", status: "pending_approval" };
      },
    } as unknown as VisitorService);

    await expect(
      controller.logVisitor(request, {
        societyId: "society_a",
        flatNumber: "A-101",
        visitorName: "Ravi",
        purpose: "delivery",
        arrivedAt: "2026-06-07T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({ logged: true });
    expect(captured?.arrivedAt).toBeInstanceOf(Date);
  });

  it("transitions a visitor through the authenticated principal", async () => {
    const controller = new VisitorController({
      transitionVisitor: async () => ({ visitorId: "visitor_1", status: "inside", action: "enter" }),
    } as unknown as VisitorService);

    await expect(
      controller.transitionVisitor(request, {
        societyId: "society_a",
        visitorId: "visitor_1",
        action: "enter",
        at: "2026-06-07T10:06:00.000Z",
      }),
    ).resolves.toMatchObject({ status: "inside" });
  });

  it("scans a patrol through the authenticated principal", async () => {
    const controller = new VisitorController({
      scanPatrol: async () => ({ recorded: true, replayed: false, patrolId: "patrol_1" }),
    } as unknown as VisitorService);

    await expect(
      controller.scanPatrol(request, {
        societyId: "society_a",
        guardId: "guard_1",
        checkpoint: "Gate A",
        scannedAt: "2026-06-07T02:00:00.000Z",
      }),
    ).resolves.toMatchObject({ recorded: true });
  });

  it("rejects calls without an attached principal", () => {
    const controller = new VisitorController({} as VisitorService);

    expect(() =>
      controller.listVisitors({ headers: {} }, { societyId: "society_a" }),
    ).toThrow(UnauthorizedException);
  });
});
