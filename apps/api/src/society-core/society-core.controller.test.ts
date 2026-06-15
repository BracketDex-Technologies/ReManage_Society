import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { SocietyCoreController } from "./society-core.controller.ts";
import { SocietyCoreService } from "./society-core.service.ts";
import { SecurityPolicyService } from "../security/security-policy.service.ts";
import type { AuthenticatedApiRequest } from "../security/authentication.guard.ts";

const request: AuthenticatedApiRequest = {
  headers: {},
  principal: {
    subject: "committee_1",
    memberships: [
      {
        societyId: "society_a",
        roles: ["committee"],
        mfaVerified: true,
      },
    ],
    platformRoles: [],
  },
};

describe("SocietyCoreController", () => {
  it("creates setup plans from the authenticated principal", () => {
    const controller = new SocietyCoreController(
      new SocietyCoreService(new SecurityPolicyService()),
    );

    const response = controller.createSetupPlan(request, {
      societyId: "society_a",
      societyName: "Palm Heights",
      buildings: [],
    });

    expect(response).toMatchObject({
      ready: true,
      societyId: "society_a",
      summary: {
        buildings: 0,
        units: 0,
      },
    });
  });

  it("rejects direct calls without an attached principal", () => {
    const controller = new SocietyCoreController(
      new SocietyCoreService(new SecurityPolicyService()),
    );

    expect(() =>
      controller.createSetupPlan(
        {
          headers: {},
        },
        {
          societyId: "society_a",
          societyName: "Palm Heights",
          buildings: [],
        },
      ),
    ).toThrow(UnauthorizedException);
  });

  it("commits setup plans through the authenticated principal", async () => {
    const controller = new SocietyCoreController({
      commitSetupPlan: async () => ({
        societyId: "society_a",
        unitsConfigured: 1,
        ready: true,
      }),
    } as unknown as SocietyCoreService);

    await expect(
      controller.commitSetupPlan(request, {
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

  it("commits imports through the authenticated principal", async () => {
    const controller = new SocietyCoreController({
      commitImportRows: async () => ({
        acceptedRows: 1,
        committedRows: 1,
        errors: [],
      }),
    } as unknown as SocietyCoreService);

    await expect(
      controller.commitImportRows(request, {
        societyId: "society_a",
        rows: [
          {
            rowNumber: 2,
            unitNumber: "A-101",
            personName: "Neha Rao",
            relationshipType: "OWNER",
          },
        ],
      }),
    ).resolves.toMatchObject({
      committedRows: 1,
    });
  });

  it("issues credentials through the authenticated principal", async () => {
    const controller = new SocietyCoreController({
      issueCredential: async () => ({
        issued: true,
        reason: "Credential account created",
        userId: "user_neha",
      }),
    } as unknown as SocietyCoreService);

    await expect(
      controller.issueCredential(request, {
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

  it("reads persisted directory through the authenticated principal", async () => {
    const controller = new SocietyCoreController({
      readDirectory: async () => [
        {
          unitNumber: "A-101",
          personName: "Neha Rao",
          relationshipType: "OWNER",
        },
      ],
    } as unknown as SocietyCoreService);

    await expect(
      controller.readDirectory(request, {
        societyId: "society_a",
      }),
    ).resolves.toEqual([
      {
        unitNumber: "A-101",
        personName: "Neha Rao",
        relationshipType: "OWNER",
      },
    ]);
  });
});
