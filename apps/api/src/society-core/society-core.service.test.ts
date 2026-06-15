import { describe, expect, it } from "vitest";
import { SocietyCoreService } from "./society-core.service.ts";
import { SecurityPolicyService } from "../security/security-policy.service.ts";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import type { SocietyCoreRepository } from "./society-core.repository.ts";

const committeePrincipal: AuthenticatedPrincipal = {
  subject: "committee_1",
  memberships: [
    {
      societyId: "society_a",
      roles: ["committee"],
      mfaVerified: true,
    },
  ],
  platformRoles: [],
};

const residentPrincipal: AuthenticatedPrincipal = {
  subject: "resident_1",
  memberships: [
    {
      societyId: "society_a",
      roles: ["resident"],
      mfaVerified: false,
    },
  ],
  platformRoles: [],
};

describe("SocietyCoreService", () => {
  it("authorizes and builds a society setup plan", () => {
    const service = new SocietyCoreService(new SecurityPolicyService());

    const plan = service.createSetupPlan(committeePrincipal, {
      societyId: "society_a",
      societyName: "Palm Heights",
      buildings: [
        {
          name: "Tower A",
          wings: [
            {
              name: "A",
              floors: [
                {
                  number: 1,
                  units: [{ unitNumber: "A-101" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(plan.ready).toBe(true);
    expect(plan.summary.units).toBe(1);
  });

  it("blocks cross-society setup planning", () => {
    const service = new SocietyCoreService(new SecurityPolicyService());

    expect(() =>
      service.createSetupPlan(committeePrincipal, {
        societyId: "society_b",
        societyName: "Other Society",
        buildings: [],
      }),
    ).toThrow(/Forbidden/);
  });

  it("uses resident visibility rules for directory reads", () => {
    const service = new SocietyCoreService(new SecurityPolicyService());

    const directory = service.buildDirectory(
      residentPrincipal,
      "society_a",
      [
        {
          unitNumber: "A-101",
          personName: "Neha Rao",
          relationshipType: "OWNER",
          phone: "9876543210",
          email: "neha@example.com",
          showPhone: false,
          showEmail: false,
        },
      ],
    );

    expect(directory).toEqual([
      {
        unitNumber: "A-101",
        personName: "Neha Rao",
        relationshipType: "OWNER",
      },
    ]);
  });

  it("authorizes setup commits through the repository", async () => {
    const repository = {
      commitSetupPlan: async () => ({
        societyId: "society_a",
        unitsConfigured: 1,
        ready: true,
      }),
    } as unknown as SocietyCoreRepository;
    const service = new SocietyCoreService(new SecurityPolicyService(), repository);

    await expect(
      service.commitSetupPlan(committeePrincipal, {
        societyId: "society_a",
        societyName: "Palm Heights",
        buildings: [],
      }),
    ).resolves.toEqual({
      societyId: "society_a",
      unitsConfigured: 1,
      ready: true,
    });
  });

  it("authorizes import commits through the repository", async () => {
    const repository = {
      commitImportRows: async () => ({
        acceptedRows: 1,
        committedRows: 1,
        errors: [],
      }),
    } as unknown as SocietyCoreRepository;
    const service = new SocietyCoreService(new SecurityPolicyService(), repository);

    await expect(
      service.commitImportRows(committeePrincipal, "society_a", [
        {
          rowNumber: 2,
          unitNumber: "A-101",
          personName: "Neha Rao",
          relationshipType: "OWNER",
        },
      ]),
    ).resolves.toEqual({
      acceptedRows: 1,
      committedRows: 1,
      errors: [],
    });
  });

  it("authorizes credential issuance through the repository", async () => {
    const repository = {
      issueCredential: async () => ({
        issued: true,
        reason: "Credential account created",
        userId: "user_neha",
      }),
    } as unknown as SocietyCoreRepository;
    const service = new SocietyCoreService(new SecurityPolicyService(), repository);

    await expect(
      service.issueCredential(committeePrincipal, {
        societyId: "society_a",
        personId: "person_neha",
        name: "Neha Rao",
        email: "neha@example.com",
        role: "member",
      }),
    ).resolves.toMatchObject({
      issued: true,
      userId: "user_neha",
    });
  });

  it("reads the persisted directory through the repository", async () => {
    const repository = {
      readDirectory: async () => [
        {
          unitNumber: "A-101",
          personName: "Neha Rao",
          relationshipType: "OWNER",
        },
      ],
    } as unknown as SocietyCoreRepository;
    const service = new SocietyCoreService(new SecurityPolicyService(), repository);

    await expect(service.readDirectory(residentPrincipal, "society_a")).resolves.toEqual([
      {
        unitNumber: "A-101",
        personName: "Neha Rao",
        relationshipType: "OWNER",
      },
    ]);
  });
});
