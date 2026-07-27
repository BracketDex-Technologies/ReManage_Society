import { describe, expect, it, vi } from "vitest";
import { MobileGuardRepository } from "./mobile-guard.repository.ts";

function visitor(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "visitor_1",
    societyId: "society_1",
    flatNumber: "A-308",
    visitorName: "Maya",
    purpose: "guest",
    status: "expected",
    residentResponse: "approved",
    phone: "+919876543210",
    vehicleNo: null,
    passcode: null,
    verificationMethod: null,
    arrivedAt: new Date("2026-07-27T08:00:00.000Z"),
    entryTime: null,
    exitTime: null,
    ...overrides,
  };
}

function createRepository(options: {
  current?: ReturnType<typeof visitor>;
  blacklist?: boolean;
  updatedCount?: number;
} = {}) {
  let current = options.current ?? visitor();
  const client = {
    flat: { findFirst: vi.fn() },
    visitor: {
      create: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; societyId?: string } }) =>
        where.id === current.id && where.societyId === current.societyId ? current : null,
      ),
      findMany: vi.fn(),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (options.updatedCount === 0) return { count: 0 };
        const statusMatches = !where.status ||
          where.status === current.status ||
          (
            typeof where.status === "object" &&
            where.status !== null &&
            "in" in where.status &&
            Array.isArray(where.status.in) &&
            where.status.in.includes(current.status)
          );
        const matches = where.id === current.id && where.societyId === current.societyId &&
          statusMatches &&
          (!where.residentResponse || where.residentResponse === current.residentResponse) &&
          (!where.verificationMethod || where.verificationMethod === current.verificationMethod);
        if (!matches) return { count: 0 };
        current = { ...current, ...data };
        return { count: 1 };
      }),
    },
    package: { count: vi.fn() },
    blacklist: { findFirst: vi.fn().mockResolvedValue(options.blacklist ? { id: "blacklist_1" } : null) },
  };
  return { client, repository: new MobileGuardRepository(client as never) };
}

describe("MobileGuardRepository transitions", () => {
  it("returns the server-owned, tenant-scoped Gate overview with non-overlapping counts", async () => {
    const { client, repository } = createRepository();
    client.visitor.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    client.package.count.mockResolvedValueOnce(4);

    await expect(repository.overview("society_1")).resolves.toEqual({
      gateLabel: "Main Gate",
      counts: { inside: 3, expected: 2, pendingApproval: 1, pendingParcels: 4 },
    });

    expect(client.visitor.count).toHaveBeenNthCalledWith(1, {
      where: { societyId: "society_1", status: { in: ["inside", "in"] } },
    });
    expect(client.visitor.count).toHaveBeenNthCalledWith(2, {
      where: {
        societyId: "society_1",
        OR: [
          { status: "expected", residentResponse: { in: ["approved", "approve"] } },
          { status: "approved" },
        ],
      },
    });
    expect(client.visitor.count).toHaveBeenNthCalledWith(3, {
      where: {
        societyId: "society_1",
        OR: [
          { status: "expected", residentResponse: null },
          { status: "pending_approval" },
        ],
      },
    });
    expect(client.package.count).toHaveBeenCalledWith({
      where: { societyId: "society_1", status: "received" },
    });
  });

  it("tenant-scopes the visitor lookup", async () => {
    const { client, repository } = createRepository();

    await expect(repository.findVisitor("society_other", "visitor_1")).resolves.toBeNull();
    expect(client.visitor.findFirst).toHaveBeenCalledWith({
      where: { id: "visitor_1", societyId: "society_other" },
    });
  });

  it("normalizes legacy and current persisted statuses at the mobile list boundary", async () => {
    const { client, repository } = createRepository();
    client.visitor.findMany.mockResolvedValue([
      visitor({ id: "legacy_in", status: "in" }),
      visitor({ id: "current_inside", status: "inside" }),
      visitor({ id: "legacy_out", status: "out" }),
      visitor({ id: "current_exited", status: "exited" }),
      visitor({ id: "current_approved", status: "approved", residentResponse: "approve", passcode: "4829" }),
    ]);

    await expect(repository.listVisitors("society_1")).resolves.toMatchObject([
      { id: "legacy_in", status: "inside", passcodeRequired: false },
      { id: "current_inside", status: "inside", passcodeRequired: false },
      { id: "legacy_out", status: "exited", passcodeRequired: false },
      { id: "current_exited", status: "exited", passcodeRequired: false },
      {
        id: "current_approved",
        status: "expected",
        residentResponse: "approved",
        passcodeRequired: true,
      },
    ]);
  });

  it("queries both legacy and current inside states for the mobile inside filter", async () => {
    const { client, repository } = createRepository();
    client.visitor.findMany.mockResolvedValue([]);

    await repository.listVisitors("society_1", "inside");

    expect(client.visitor.findMany).toHaveBeenCalledWith({
      where: { societyId: "society_1", status: { in: ["inside", "in"] } },
      orderBy: { arrivedAt: "desc" },
    });
  });

  it("creates an actionable non-pre-approved request and notifies the linked residents", async () => {
    const created = visitor({
      id: "visitor_mobile",
      status: "expected",
      residentResponse: null,
      passcode: "4829",
    });
    const client: Record<string, unknown> = {
      flat: {
        findFirst: vi.fn().mockResolvedValue({
          id: "flat_1",
          flatNumber: "A-308",
          units: [{
            occupancies: [{
              person: { users: [{ id: "resident_1" }, { id: "resident_2" }] },
            }],
          }],
        }),
      },
      visitor: {
        create: vi.fn().mockResolvedValue(created),
      },
      package: { count: vi.fn() },
      blacklist: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findMany: vi.fn() },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    client.$transaction = vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback(client));
    const repository = new MobileGuardRepository(client as never);

    await expect(repository.requestVisitor({
      societyId: "society_1",
      flatQuery: " A-308 ",
      visitorName: " Maya ",
      purpose: " guest ",
      passcode: "4829",
    })).resolves.toMatchObject({
      id: "visitor_mobile",
      status: "expected",
      passcodeRequired: true,
      residentResponse: null,
    });

    expect((client.visitor as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: "society_1",
        flatId: "flat_1",
        status: "expected",
        isPreApproved: false,
        verificationMethod: "manual",
      }),
    });
    expect((client.notification as { createMany: ReturnType<typeof vi.fn> }).createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          societyId: "society_1",
          userId: "resident_1",
          type: "visitor_entry",
          link: "/my-visitors?approve=visitor_mobile",
        }),
        expect.objectContaining({
          societyId: "society_1",
          userId: "resident_2",
          type: "visitor_entry",
          link: "/my-visitors?approve=visitor_mobile",
        }),
      ],
    });
  });

  it("rejects a stale check-in write when expected approval is no longer present", async () => {
    const { client, repository } = createRepository({ updatedCount: 0 });

    await expect(repository.markEntered("society_1", "visitor_1")).rejects.toMatchObject({
      code: "visitor_not_approved",
    });
    expect(client.visitor.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "visitor_1",
        societyId: "society_1",
        OR: [
          { status: "expected", residentResponse: { in: ["approved", "approve"] } },
          { status: "approved" },
        ],
      }),
    }));
  });

  it("rejects a stale check-out write when the visitor is no longer inside", async () => {
    const { client, repository } = createRepository({
      current: visitor({ status: "inside" }),
      updatedCount: 0,
    });

    await expect(repository.markExited("society_1", "visitor_1")).rejects.toMatchObject({
      code: "visitor_not_inside",
    });
    expect(client.visitor.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "visitor_1",
        societyId: "society_1",
        status: { in: ["inside", "in"] },
      }),
    }));
  });

  it("persists an expected approved visitor as inside with a tenant-scoped state predicate", async () => {
    const { client, repository } = createRepository();

    await expect(repository.markEntered("society_1", "visitor_1")).resolves.toMatchObject({
      id: "visitor_1",
      status: "inside",
      entryTime: expect.any(String),
    });
    expect(client.visitor.updateMany).toHaveBeenCalledWith({
      where: {
        id: "visitor_1",
        societyId: "society_1",
        OR: [
          { status: "expected", residentResponse: { in: ["approved", "approve"] } },
          { status: "approved" },
        ],
      },
      data: { status: "inside", entryTime: expect.any(Date) },
    });
  });

  it("admits a canonically approved visitor and emits the documented expected-to-inside shape", async () => {
    const { repository } = createRepository({
      current: visitor({ status: "approved", residentResponse: "approve" }),
    });

    await expect(repository.markEntered("society_1", "visitor_1")).resolves.toMatchObject({
      id: "visitor_1",
      status: "inside",
      residentResponse: "approved",
    });
  });

  it.each(["inside", "in"])("persists a %s visitor as canonical exited with a tenant-scoped state predicate", async (status) => {
    const { client, repository } = createRepository({
      current: visitor({ status }),
    });

    await expect(repository.markExited("society_1", "visitor_1")).resolves.toMatchObject({
      id: "visitor_1",
      status: "exited",
      exitTime: expect.any(String),
    });
    expect(client.visitor.updateMany).toHaveBeenCalledWith({
      where: { id: "visitor_1", societyId: "society_1", status: { in: ["inside", "in"] } },
      data: { status: "exited", exitTime: expect.any(Date) },
    });
  });

  it("rechecks blacklist and passcode state before a check-in transition", async () => {
    const blacklisted = createRepository({ blacklist: true });
    await expect(blacklisted.repository.markEntered("society_1", "visitor_1")).rejects.toMatchObject({
      code: "visitor_blacklisted",
    });
    expect(blacklisted.client.visitor.updateMany).not.toHaveBeenCalled();

    const passcodeRequired = createRepository({
      current: visitor({ passcode: "4829", verificationMethod: null }),
    });
    await expect(passcodeRequired.repository.markEntered("society_1", "visitor_1")).rejects.toMatchObject({
      code: "passcode_verification_required",
    });
    expect(passcodeRequired.client.visitor.updateMany).not.toHaveBeenCalled();
  });
});
