import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { FileStoragePolicyService } from "../security/file-storage-policy.service.js";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { DocumentService } from "./document.service.js";
import type { DocumentRepository } from "./document.repository.js";

function principal(roles: string[], mfaVerified = false): AuthenticatedPrincipal {
  return {
    subject: "actor_1",
    memberships: [{ societyId: "society_a", roles: roles as never, mfaVerified }],
    platformRoles: [],
  };
}

function createService(repository: Partial<DocumentRepository>) {
  const fileStorage = new FileStoragePolicyService({
    presigner: { presignPutObject: () => "https://signed.example/put" },
    now: () => new Date("2026-06-07T00:00:00.000Z"),
  });
  return new DocumentService(
    new SecurityPolicyService(),
    fileStorage,
    repository as DocumentRepository,
  );
}

describe("DocumentService", () => {
  it("requires MFA to create a document", async () => {
    const service = createService({ createDocument: vi.fn() });

    await expect(
      service.createDocument(principal(["committee"], false), {
        societyId: "society_a",
        title: "Bylaws",
        fileName: "b.pdf",
        fileUrl: "key",
        uploadedBy: "c1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets an MFA committee member create a document and returns an upload intent", async () => {
    const service = createService({
      createDocument: vi.fn().mockResolvedValue({ created: true, scope: "society" }),
    });

    const intent = service.createUploadIntent(principal(["committee"], true), {
      societyId: "society_a",
      fileName: "b.pdf",
      contentType: "application/pdf",
      actorId: "c1",
    });
    expect(intent).toMatchObject({ method: "PUT", signedUrl: "https://signed.example/put" });

    await expect(
      service.createDocument(principal(["committee"], true), {
        societyId: "society_a",
        title: "Bylaws",
        fileName: "b.pdf",
        fileUrl: intent.objectKey,
        uploadedBy: "c1",
      }),
    ).resolves.toMatchObject({ created: true });
  });

  it("passes manager visibility for committee viewers", async () => {
    const listDocuments = vi.fn().mockResolvedValue([]);
    const service = createService({ listDocuments });

    await service.listDocuments(principal(["committee"], false), {
      societyId: "society_a",
      userId: "c1",
    });

    expect(listDocuments).toHaveBeenCalledWith("society_a", expect.objectContaining({ isManager: true }));
  });

  it("passes non-manager visibility for residents", async () => {
    const listDocuments = vi.fn().mockResolvedValue([]);
    const service = createService({ listDocuments });

    await service.listDocuments(principal(["resident"], false), {
      societyId: "society_a",
      userId: "u1",
      flatNumber: "A-101",
    });

    expect(listDocuments).toHaveBeenCalledWith(
      "society_a",
      expect.objectContaining({ isManager: false, flatNumber: "A-101" }),
    );
  });
});
