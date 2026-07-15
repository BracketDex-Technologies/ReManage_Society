import { describe, expect, it } from "vitest";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import {
  MobileIdentityRepository,
  type MobileIdentityPersistenceClient,
} from "./mobile-identity.repository.ts";

interface FakeAssignment {
  role: string;
  permissionRole: string;
  revokedAt: Date | null;
}

interface FakeMembership {
  id: string;
  societyId: string;
  flatId: string | null;
  status: string;
  society: { name: string };
  roleAssignments: FakeAssignment[];
}

interface FakeUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
  memberships: FakeMembership[];
}

function createConfig() {
  return new MobileConfigService({
    MOBILE_API_ENABLED: "true",
    MOBILE_BETA_SOCIETY_ID: "society_beta",
    MOBILE_ACCESS_TOKEN_SECRET: "mobile-access-secret-with-at-least-32-characters",
    MOBILE_REFRESH_TOKEN_PEPPER: "refresh-pepper-with-at-least-32-characters",
    MOBILE_OTP_PEPPER: "mobile-otp-pepper-with-at-least-32-characters",
  });
}

function approvedUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: "user_1",
    name: "Resident One",
    email: "resident@example.com",
    password: "stored-password-hash",
    role: "chairman",
    isActive: true,
    memberships: [
      {
        id: "membership_1",
        societyId: "society_beta",
        flatId: "flat_1",
        status: "active",
        society: { name: "Beta Society" },
        roleAssignments: [
          {
            role: "resident",
            permissionRole: "member",
            revokedAt: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createClient(user: FakeUser | null) {
  const calls: unknown[] = [];
  const client: MobileIdentityPersistenceClient = {
    user: {
      findFirst: async (input) => {
        calls.push(input);
        return user;
      },
    },
  };
  return { calls, client };
}

describe("MobileIdentityRepository", () => {
  it("normalizes email and scopes lookup to an active user and active beta membership", async () => {
    const { calls, client } = createClient(approvedUser());
    const repository = new MobileIdentityRepository(client, createConfig());

    const identity = await repository.findApprovedByEmail("  Resident@Example.COM  ");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      where: {
        email: "resident@example.com",
        isActive: true,
      },
      select: {
        memberships: {
          where: {
            societyId: "society_beta",
            status: "active",
          },
          take: 1,
          select: {
            roleAssignments: {
              where: { revokedAt: null },
            },
          },
        },
      },
    });
    expect((calls[0] as { select: Record<string, unknown> }).select).not.toHaveProperty("role");
    expect(identity).toEqual({
      userId: "user_1",
      name: "Resident One",
      email: "resident@example.com",
      passwordHash: "stored-password-hash",
      societyId: "society_beta",
      societyName: "Beta Society",
      membershipId: "membership_1",
      flatId: "flat_1",
      roles: [{ role: "resident", permissionRole: "member" }],
    });
  });

  it("returns null when the active beta membership is absent", async () => {
    const { client } = createClient(approvedUser({ memberships: [] }));
    const repository = new MobileIdentityRepository(client, createConfig());

    await expect(repository.findApprovedByEmail("resident@example.com")).resolves.toBeNull();
  });

  it("returns null when no non-revoked compatible Resident or Guard assignment exists", async () => {
    const user = approvedUser();
    user.memberships[0].roleAssignments = [
      { role: "chairman", permissionRole: "member", revokedAt: null },
      { role: "guard", permissionRole: "member", revokedAt: null },
      { role: "resident", permissionRole: "guard", revokedAt: null },
      { role: "resident", permissionRole: "member", revokedAt: new Date() },
    ];
    const { client } = createClient(user);
    const repository = new MobileIdentityRepository(client, createConfig());

    await expect(repository.findApprovedByEmail("resident@example.com")).resolves.toBeNull();
  });

  it("returns both approved role assignments for a dual-role account", async () => {
    const user = approvedUser();
    user.memberships[0].roleAssignments = [
      { role: "guard", permissionRole: "guard", revokedAt: null },
      { role: "member", permissionRole: "tenant", revokedAt: null },
      { role: "watchman", permissionRole: "member", revokedAt: null },
      { role: "resident", permissionRole: "resident", revokedAt: new Date() },
    ];
    const { client } = createClient(user);
    const repository = new MobileIdentityRepository(client, createConfig());

    await expect(repository.findApprovedByEmail("resident@example.com")).resolves.toMatchObject({
      roles: [
        { role: "guard", permissionRole: "guard" },
        { role: "resident", permissionRole: "tenant" },
      ],
    });
  });
});
