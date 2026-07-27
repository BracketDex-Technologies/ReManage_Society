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
        const matches = where.id === current.id && where.societyId === current.societyId &&
          (!where.status || where.status === current.status) &&
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
      where: { societyId: "society_1", status: "in" },
    });
    expect(client.visitor.count).toHaveBeenNthCalledWith(2, {
      where: { societyId: "society_1", status: "expected", residentResponse: "approved" },
    });
    expect(client.visitor.count).toHaveBeenNthCalledWith(3, {
      where: {
        societyId: "society_1",
        status: "expected",
        residentResponse: null,
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

  it("rejects a stale check-in write when expected approval is no longer present", async () => {
    const { client, repository } = createRepository({ updatedCount: 0 });

    await expect(repository.markEntered("society_1", "visitor_1")).rejects.toMatchObject({
      code: "visitor_not_approved",
    });
    expect(client.visitor.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "visitor_1",
        societyId: "society_1",
        status: "expected",
        residentResponse: "approved",
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
      where: expect.objectContaining({ id: "visitor_1", societyId: "society_1", status: "inside" }),
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
        status: "expected",
        residentResponse: "approved",
      },
      data: { status: "inside", entryTime: expect.any(Date) },
    });
  });

  it("persists an inside visitor as exited with a tenant-scoped state predicate", async () => {
    const { client, repository } = createRepository({
      current: visitor({ status: "inside" }),
    });

    await expect(repository.markExited("society_1", "visitor_1")).resolves.toMatchObject({
      id: "visitor_1",
      status: "exited",
      exitTime: expect.any(String),
    });
    expect(client.visitor.updateMany).toHaveBeenCalledWith({
      where: { id: "visitor_1", societyId: "society_1", status: "inside" },
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
