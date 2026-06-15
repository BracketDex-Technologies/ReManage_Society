import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { GovernanceService } from "./governance.service.js";
import type { GovernanceRepository } from "./governance.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<GovernanceRepository>) {
  return new GovernanceService(new SecurityPolicyService(), repository as GovernanceRepository);
}

describe("GovernanceService", () => {
  it("requires MFA to record meetings and create polls", async () => {
    const service = createService({ recordMeeting: vi.fn(), createPoll: vi.fn() });

    await expect(
      service.recordMeeting(principal(["committee"], false), {
        societyId: "society_a",
        title: "AGM",
        date: new Date(),
        agenda: "a",
        minutes: "m",
        recordedBy: "c1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.createPoll(principal(["committee"], false), {
        societyId: "society_a",
        title: "x",
        options: ["A", "B"],
        createdBy: "c1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a resident cast a vote and read results without MFA", async () => {
    const service = createService({
      castVote: vi.fn().mockResolvedValue({ voted: true }),
      getPollResults: vi.fn().mockResolvedValue({ totalVotes: 1 }),
    });

    await expect(
      service.castVote(principal(["resident"]), {
        societyId: "society_a",
        pollId: "poll_1",
        voterRef: "A-101",
        optionIndex: 0,
      }),
    ).resolves.toMatchObject({ voted: true });
    await expect(
      service.getPollResults(principal(["resident"]), "society_a", "poll_1"),
    ).resolves.toMatchObject({ totalVotes: 1 });
  });

  it("forbids a resident from creating a poll", async () => {
    const service = createService({ createPoll: vi.fn() });

    await expect(
      service.createPoll(principal(["resident"]), {
        societyId: "society_a",
        title: "x",
        options: ["A", "B"],
        createdBy: "u1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
