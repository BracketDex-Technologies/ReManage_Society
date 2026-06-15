import { describe, expect, it } from "vitest";
import { FileStoragePolicyService } from "./file-storage-policy.service.ts";

describe("FileStoragePolicyService", () => {
  it("creates short-lived tenant-scoped signed upload intents", () => {
    const service = new FileStoragePolicyService({
      bucket: "society-connect-local",
      endpoint: "http://localhost:9000",
      accessKeyId: "local-access",
      secretAccessKey: "local-secret",
      region: "us-east-1",
      now: () => new Date("2026-06-06T08:00:00.000Z"),
    });

    expect(
      service.createUploadIntent({
        societyId: "society_a",
        actorId: "user_123",
        fileName: "notice.pdf",
        contentType: "application/pdf",
      }),
    ).toMatchObject({
      bucket: "society-connect-local",
      method: "PUT",
      objectKey: "societies/society_a/uploads/notice.pdf",
      expiresAt: "2026-06-06T08:05:00.000Z",
    });
    expect(
      service.createUploadIntent({
        societyId: "society_a",
        actorId: "user_123",
        fileName: "notice.pdf",
        contentType: "application/pdf",
      }).signedUrl,
    ).toContain("X-Amz-Signature=");
  });
});
