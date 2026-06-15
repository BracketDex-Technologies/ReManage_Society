import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { AuthenticatedApiRequest } from "../security/authentication.guard.ts";
import { NoticeController } from "./notice.controller.ts";
import type { NoticeService } from "./notice.service.ts";

const request: AuthenticatedApiRequest = {
  headers: {},
  principal: {
    subject: "committee_1",
    memberships: [{ societyId: "society_a", roles: ["committee"], mfaVerified: false }],
    platformRoles: [],
  },
};

describe("NoticeController", () => {
  it("parses expiry and creates a notice through the authenticated principal", async () => {
    let captured: { expiresAt?: Date } | undefined;
    const controller = new NoticeController({
      createNotice: async (_principal: unknown, command: { expiresAt?: Date }) => {
        captured = command;
        return { created: true, noticeId: "notice_1", category: "general" };
      },
    } as unknown as NoticeService);

    await expect(
      controller.create(request, {
        societyId: "society_a",
        title: "Hi",
        body: "There",
        postedBy: "committee_1",
        expiresAt: "2026-06-10T00:00:00.000Z",
      }),
    ).resolves.toMatchObject({ created: true });
    expect(captured?.expiresAt).toBeInstanceOf(Date);
  });

  it("marks a notice read through the authenticated principal", async () => {
    const controller = new NoticeController({
      markRead: async () => ({ acknowledged: true, replayed: false, readId: "read_1" }),
    } as unknown as NoticeService);

    await expect(
      controller.markRead(request, {
        societyId: "society_a",
        noticeId: "notice_1",
        userId: "user_1",
        userName: "Ravi",
      }),
    ).resolves.toMatchObject({ acknowledged: true });
  });

  it("rejects calls without an attached principal", () => {
    const controller = new NoticeController({} as NoticeService);

    expect(() =>
      controller.list({ headers: {} }, { societyId: "society_a" }),
    ).toThrow(UnauthorizedException);
  });
});
