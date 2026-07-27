import { describe, expect, it, vi } from "vitest";
import type { MobileAuthenticatedRequest } from "../common/mobile-request.ts";
import { MobileGuardController } from "./mobile-guard.controller.ts";
import type { MobileGuardService } from "./mobile-guard.service.ts";

const guardRequest = {
  id: "request_guard_1",
  mobileSession: {
    sessionId: "session_guard_1",
    userId: "user_guard_1",
    membershipId: "membership_guard_1",
    societyId: "society_server_1",
    activeRole: "guard",
    activePermissionRole: "guard",
    version: 1,
  },
} as unknown as MobileAuthenticatedRequest;

function createController() {
  const guards = {
    overview: vi.fn().mockResolvedValue({ expectedCount: 0, insideCount: 0 }),
    listVisitors: vi.fn().mockResolvedValue([]),
    requestVisitor: vi.fn().mockResolvedValue({ id: "visitor_1", status: "expected" }),
    getVisitor: vi.fn().mockResolvedValue({ id: "visitor_1", status: "expected" }),
    verifyPasscode: vi.fn().mockResolvedValue({ id: "visitor_1", passcodeVerified: true }),
    checkIn: vi.fn().mockResolvedValue({ id: "visitor_1", status: "inside" }),
    checkOut: vi.fn().mockResolvedValue({ id: "visitor_1", status: "exited" }),
  };
  return {
    guards,
    controller: new MobileGuardController(guards as unknown as MobileGuardService),
  };
}

describe("MobileGuardController", () => {
  it("returns the Gate overview from the trusted mobile session", async () => {
    const { controller, guards } = createController();
    guards.overview.mockResolvedValue({
      gateLabel: "Main Gate",
      counts: { inside: 3, expected: 2, pendingApproval: 1, pendingParcels: 4 },
    });

    await expect(controller.overview(guardRequest)).resolves.toEqual({
      gateLabel: "Main Gate",
      counts: { inside: 3, expected: 2, pendingApproval: 1, pendingParcels: 4 },
    });
    expect(guards.overview).toHaveBeenCalledWith(guardRequest.mobileSession);
  });

  it("forwards only the MobileSessionGuard session context to a visitor request", async () => {
    const { controller, guards } = createController();
    const body = { flatQuery: "A-308", visitorName: "Maya", purpose: "guest" };

    await expect(controller.requestVisitor(guardRequest, body)).resolves.toMatchObject({
      id: "visitor_1",
      status: "expected",
    });
    expect(guards.requestVisitor).toHaveBeenCalledWith(guardRequest.mobileSession, body);
  });

  it("passes the trusted session to check-in without a client actor or society field", async () => {
    const { controller, guards } = createController();

    await expect(controller.checkIn(guardRequest, "visitor_1")).resolves.toMatchObject({
      status: "inside",
    });
    expect(guards.checkIn).toHaveBeenCalledWith(guardRequest.mobileSession, "visitor_1");
  });
});
