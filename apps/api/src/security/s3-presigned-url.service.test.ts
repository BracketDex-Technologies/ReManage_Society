import { describe, expect, it } from "vitest";
import { S3PresignedUrlService } from "./s3-presigned-url.service.ts";

describe("S3PresignedUrlService", () => {
  it("creates SigV4-style presigned URLs without exposing the secret key", () => {
    const service = new S3PresignedUrlService({
      accessKeyId: "local-access",
      secretAccessKey: "local-secret",
      region: "us-east-1",
      endpoint: "http://localhost:9000",
      now: () => new Date("2026-06-06T08:00:00.000Z"),
    });

    const url = service.presignPutObject({
      bucket: "society-connect-local",
      objectKey: "societies/society_a/uploads/notice.pdf",
      contentType: "application/pdf",
      expiresInSeconds: 300,
    });

    expect(url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(url).toContain("X-Amz-Credential=local-access%2F20260606%2Fus-east-1%2Fs3%2Faws4_request");
    expect(url).toContain("X-Amz-Signature=");
    expect(url).not.toContain("local-secret");
  });
});
