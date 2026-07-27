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
      findFirst: vi.fn(async ({ where }: { where: { id?: string; societyId?: string } }) =>
        where.id === current.id && where.societyId === current.societyId ? current : null,
      ),
      findMany: vi.fn(),
      update: vi.fn(),
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
    blacklist: { findFirst: vi.fn().mockResolvedValue(options.blacklist ? { id: "blacklist_1" } : null) },
  };
  return { client, repository: new MobileGuardRepository(client as never) };
}

describe("MobileGuardRepository transitions", () => {
  it("tenant-scopes the visitor lookup", async () => {
    const { client, repository } = createRepository();

    await expect(repository.findVisitor("society_other", "visitor_1")).resolves.toBeNull();
    expect(client.visitor.findFirst).toHaveBeenCalledWith({
      where: { id: "visitor_1", societyId: "society_other" },
    });
  });

  it("rejects a stale check-in write when expected approval is no longer present", async () => {
    const { client, repository } = createRepository({ updatedCount: 0 });

    await expect(repository.markEntered("society_1", "visitor_1", "user_guard_1")).rejects.toMatchObject({
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
    expect(client.visitor.update).not.toHaveBeenCalled();
  });

  it("rejects a stale check-out write when the visitor is no longer inside", async () => {
    const { client, repository } = createRepository({
      current: visitor({ status: "inside" }),
      updatedCount: 0,
    });

    await expect(repository.markExited("society_1", "visitor_1", "user_guard_1")).rejects.toMatchObject({
      code: "visitor_not_inside",
    });
    expect(client.visitor.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "visitor_1", societyId: "society_1", status: "inside" }),
    }));
  });

  it("rechecks blacklist and passcode state before a check-in transition", async () => {
    const blacklisted = createRepository({ blacklist: true });
    await expect(blacklisted.repository.markEntered("society_1", "visitor_1", "user_guard_1")).rejects.toMatchObject({
      code: "visitor_blacklisted",
    });
    expect(blacklisted.client.visitor.updateMany).not.toHaveBeenCalled();

    const passcodeRequired = createRepository({
      current: visitor({ passcode: "4829", verificationMethod: null }),
    });
    await expect(passcodeRequired.repository.markEntered("society_1", "visitor_1", "user_guard_1")).rejects.toMatchObject({
      code: "passcode_verification_required",
    });
    expect(passcodeRequired.client.visitor.updateMany).not.toHaveBeenCalled();
  });
});
