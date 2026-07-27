import { describe, expect, it, vi } from "vitest";
import { VisitorRepository } from "../../operations/visitor.repository.ts";
import type { MobileAuthenticatedRequest } from "../common/mobile-request.ts";
import { MobileGuardRepository } from "./mobile-guard.repository.ts";
import { MobileGuardService } from "./mobile-guard.service.ts";

const guardSession: NonNullable<MobileAuthenticatedRequest["mobileSession"]> = {
  sessionId: "session_guard_1",
  userId: "user_guard_1",
  membershipId: "membership_guard_1",
  societyId: "society_1",
  activeRole: "guard",
  activePermissionRole: "guard",
  version: 1,
};

describe("mobile Guard to Resident approval flow", () => {
  it("moves a server-scoped mobile request through Resident approval and Guard check-in", async () => {
    let storedVisitor: Record<string, unknown> | null = null;
    const notifications: Record<string, unknown>[] = [];
    const persistence: Record<string, unknown> = {
      flat: {
        findFirst: vi.fn().mockResolvedValue({
          id: "flat_1",
          flatNumber: "A-308",
          units: [{
            occupancies: [{
              person: { users: [{ id: "resident_1" }] },
            }],
          }],
        }),
      },
      blacklist: { findFirst: vi.fn().mockResolvedValue(null) },
      package: { count: vi.fn().mockResolvedValue(0) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      notification: {
        createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
          notifications.push(...data);
          return { count: data.length };
        }),
      },
      visitor: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          storedVisitor = {
            id: "visitor_1",
            residentResponse: null,
            phone: null,
            vehicleNo: null,
            passcode: null,
            verificationMethod: null,
            entryTime: null,
            exitTime: null,
            ...data,
          };
          return storedVisitor;
        }),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (!storedVisitor) return null;
          return storedVisitor.id === where.id && storedVisitor.societyId === where.societyId
            ? storedVisitor
            : null;
        }),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          storedVisitor?.id === where.id ? storedVisitor : null),
        findMany: vi.fn(async () => storedVisitor ? [storedVisitor] : []),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (!storedVisitor) throw new Error("missing visitor");
          storedVisitor = { ...storedVisitor, ...data };
          return storedVisitor;
        }),
        updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          if (!storedVisitor || storedVisitor.id !== where.id || storedVisitor.societyId !== where.societyId) {
            return { count: 0 };
          }
          storedVisitor = { ...storedVisitor, ...data };
          return { count: 1 };
        }),
      },
      guardPatrol: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };
    persistence.$transaction = vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) => callback(persistence),
    );

    const mobileRepository = new MobileGuardRepository(persistence as never);
    const residentRepository = new VisitorRepository(persistence as never);
    const guardService = new MobileGuardService(
      mobileRepository,
      { record: vi.fn().mockResolvedValue(undefined) },
    );

    const requested = await guardService.requestVisitor(guardSession, {
      flatQuery: "A-308",
      visitorName: "Maya Shah",
      purpose: "guest",
    });
    expect(requested).toMatchObject({
      id: "visitor_1",
      status: "expected",
      residentResponse: null,
      passcodeRequired: false,
    });
    expect(storedVisitor).toMatchObject({
      societyId: "society_1",
      flatId: "flat_1",
      isPreApproved: false,
    });
    expect(notifications).toEqual([
      expect.objectContaining({
        userId: "resident_1",
        link: "/my-visitors?approve=visitor_1",
      }),
    ]);

    await expect(residentRepository.respondToVisitor({
      societyId: "society_1",
      visitorId: "visitor_1",
      decision: "approve",
      respondedAt: new Date("2026-07-27T12:35:00.000Z"),
    })).resolves.toEqual({
      visitorId: "visitor_1",
      status: "expected",
      action: "approve",
    });

    await expect(guardService.checkIn(guardSession, "visitor_1")).resolves.toMatchObject({
      id: "visitor_1",
      status: "inside",
      residentResponse: "approved",
    });
  });
});
