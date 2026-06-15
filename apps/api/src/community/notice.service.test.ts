import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { NoticeService } from "./notice.service.js";
import type { NoticeRepository } from "./notice.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<NoticeRepository>) {
  return new NoticeService(new SecurityPolicyService(), repository as NoticeRepository);
}

describe("NoticeService", () => {
  it("lets committee publish a notice", async () => {
    const createNotice = vi
      .fn()
      .mockResolvedValue({ created: true, noticeId: "notice_1", category: "general" });
    const service = createService({ createNotice });

    await expect(
      service.createNotice(principal(["committee"]), {
        societyId: "society_a",
        title: "Hi",
        body: "There",
        postedBy: "committee_1",
      }),
    ).resolves.toMatchObject({ created: true });
    expect(createNotice).toHaveBeenCalledOnce();
  });

  it("forbids a resident from publishing a notice", async () => {
    const service = createService({ createNotice: vi.fn() });

    await expect(
      service.createNotice(principal(["resident"]), {
        societyId: "society_a",
        title: "Hi",
        body: "There",
        postedBy: "resident_1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a resident read notices and mark them read", async () => {
    const service = createService({
      listNotices: vi.fn().mockResolvedValue([]),
      markRead: vi.fn().mockResolvedValue({ acknowledged: true, replayed: false }),
    });

    await expect(
      service.listNotices(principal(["resident"]), { societyId: "society_a" }),
    ).resolves.toEqual([]);
    await expect(
      service.markRead(principal(["resident"]), {
        societyId: "society_a",
        noticeId: "notice_1",
        userId: "resident_1",
        userName: "Ravi",
      }),
    ).resolves.toMatchObject({ acknowledged: true });
  });

  it("forbids a resident from reading notice read receipts", async () => {
    const service = createService({ listReadReceipts: vi.fn() });

    await expect(
      service.listReadReceipts(principal(["resident"]), "society_a", "notice_1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
