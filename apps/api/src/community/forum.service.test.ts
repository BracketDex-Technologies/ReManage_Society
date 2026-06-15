import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { ForumService } from "./forum.service.js";
import type { ForumRepository } from "./forum.repository.js";

function principal(roles: string[]): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified: false }],
    platformRoles: [],
  };
}

function createService(repository: Partial<ForumRepository>) {
  return new ForumService(new SecurityPolicyService(), repository as ForumRepository);
}

describe("ForumService", () => {
  it("lets a resident post and reply", async () => {
    const service = createService({
      createThread: vi.fn().mockResolvedValue({ created: true }),
      replyThread: vi.fn().mockResolvedValue({ replied: true }),
    });

    await expect(
      service.createThread(principal(["resident"]), {
        societyId: "society_a",
        authorId: "u1",
        title: "Hi",
        content: "Hello",
      }),
    ).resolves.toMatchObject({ created: true });
  });

  it("forbids a resident from moderating", async () => {
    const service = createService({ moderateThread: vi.fn() });

    await expect(
      service.moderateThread(principal(["resident"]), {
        societyId: "society_a",
        threadId: "thread_1",
        action: "lock",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets committee moderate", async () => {
    const service = createService({ moderateThread: vi.fn().mockResolvedValue({ moderated: true }) });

    await expect(
      service.moderateThread(principal(["committee"]), {
        societyId: "society_a",
        threadId: "thread_1",
        action: "lock",
      }),
    ).resolves.toMatchObject({ moderated: true });
  });
});
