import { describe, expect, it, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import type { MobileAuthenticatedRequest } from "../common/mobile-request.ts";
import { MobileGuardService } from "./mobile-guard.service.ts";
import type { MobileGuardRepository } from "./mobile-guard.repository.ts";

const guardSession: NonNullable<MobileAuthenticatedRequest["mobileSession"]> = {
  sessionId: "session_guard_1",
  userId: "user_guard_1",
  membershipId: "membership_guard_1",
  societyId: "society_server_1",
  activeRole: "guard",
  activePermissionRole: "guard",
  version: 1,
};

function createService() {
  const repository = {
    overview: vi.fn().mockResolvedValue({ expectedCount: 0, insideCount: 0 }),
    listVisitors: vi.fn().mockResolvedValue([]),
    requestVisitor: vi.fn().mockResolvedValue({ id: "visitor_1", status: "expected" }),
    findVisitor: vi.fn().mockResolvedValue({
      id: "visitor_1",
      status: "expected",
      residentResponse: "approved",
      passcode: null,
      verificationMethod: null,
    }),
    verifyPasscode: vi.fn().mockResolvedValue({ id: "visitor_1", passcodeVerified: true }),
    markEntered: vi.fn().mockResolvedValue({ id: "visitor_1", status: "inside" }),
    markExited: vi.fn().mockResolvedValue({ id: "visitor_1", status: "exited" }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    repository,
    audit,
    service: new MobileGuardService(
      repository as unknown as MobileGuardRepository,
      audit,
    ),
  };
}

describe("MobileGuardService", () => {
  it("does not accept a client supplied society ID", async () => {
    const { repository, service } = createService();

    await expect(
      service.requestVisitor(guardSession, {
        flatQuery: "A-308",
        visitorName: "Maya",
        purpose: "guest",
      }),
    ).resolves.toMatchObject({ status: "expected" });

    expect(repository.requestVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ societyId: guardSession.societyId }),
    );
    expect(repository.requestVisitor).not.toHaveBeenCalledWith(
      expect.objectContaining({ societyId: "society_client_1" }),
    );
  });

  it("rejects a check-in before resident approval", async () => {
    const { repository, service } = createService();
    repository.findVisitor.mockResolvedValue({
      id: "visitor_1",
      status: "expected",
      residentResponse: null,
      passcode: null,
      verificationMethod: null,
    });

    await expect(service.checkIn(guardSession, "visitor_1")).rejects.toMatchObject({
      code: "visitor_not_approved",
    });
    expect(repository.markEntered).not.toHaveBeenCalled();
  });

  it("returns the approval rejection as an HTTP mobile problem", async () => {
    const { repository, service } = createService();
    repository.findVisitor.mockResolvedValue({
      id: "visitor_1",
      status: "expected",
      residentResponse: null,
      passcode: null,
      verificationMethod: null,
    });

    const failure = await service.checkIn(guardSession, "visitor_1").catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "visitor_not_approved" });
    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(409);
  });

  it("rejects a resident-active mobile session before querying guard data", async () => {
    const { repository, service } = createService();

    await expect(
      service.listVisitors({ ...guardSession, activeRole: "resident", activePermissionRole: "member" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.listVisitors).not.toHaveBeenCalled();
  });

  it("records the trusted guard actor when a resident-approved visitor checks in", async () => {
    const { audit, repository, service } = createService();

    await expect(service.checkIn(guardSession, "visitor_1")).resolves.toMatchObject({
      status: "inside",
    });
    expect(repository.markEntered).toHaveBeenCalledWith(guardSession.societyId, "visitor_1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: guardSession.userId,
        societyId: guardSession.societyId,
        action: "operations:gate.manage",
        targetType: "mobile_guard_visitor",
        targetId: "visitor_1",
        metadata: { event: "visitor_checked_in", activeRole: "guard" },
      }),
    );
  });

  it("does not record a second audit event when the atomic check-in write is rejected", async () => {
    const { audit, repository, service } = createService();
    repository.markEntered.mockRejectedValue({ code: "visitor_not_approved", status: 409 });

    await expect(service.checkIn(guardSession, "visitor_1")).rejects.toMatchObject({
      code: "visitor_not_approved",
    });
    expect(audit.record).not.toHaveBeenCalled();
  });
});
