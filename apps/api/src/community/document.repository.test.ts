import { describe, expect, it } from "vitest";
import { DocumentRepository, type DocumentPersistenceClient } from "./document.repository.ts";

interface DocRow {
  id: string;
  societyId: string;
  title: string;
  category: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  uploadedBy: string;
  createdAt: Date;
}

function createClient(docs: DocRow[] = []) {
  const log: Array<Record<string, unknown>> = [];
  const client: DocumentPersistenceClient & { log: typeof log } = {
    log,
    document: {
      create: async (input) => {
        log.push(input.data);
        return {
          id: "doc_1",
          fileSize: null,
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          ...(input.data as Record<string, unknown>),
        } as DocRow;
      },
      findMany: async () => docs,
    },
  };

  return client;
}

function doc(partial: Partial<DocRow> & { id: string; category: string }): DocRow {
  return {
    societyId: "society_a",
    title: "Doc",
    fileName: "doc.pdf",
    fileUrl: "societies/society_a/uploads/doc.pdf",
    fileSize: null,
    uploadedBy: "c1",
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
    ...partial,
  };
}

describe("DocumentRepository", () => {
  it("encodes scope and category on create", async () => {
    const client = createClient();
    const repository = new DocumentRepository(client);

    const result = await repository.createDocument({
      societyId: "society_a",
      title: "NOC Letter",
      category: "noc",
      scope: "flat",
      ownerRef: "A-101",
      fileName: "noc.pdf",
      fileUrl: "societies/society_a/uploads/noc.pdf",
      uploadedBy: "c1",
    });

    expect(result).toMatchObject({ created: true, scope: "flat", ownerRef: "A-101", category: "noc" });
    expect(client.log[0]).toMatchObject({ category: "noc#flat:A-101" });
  });

  it("filters documents by viewer visibility", async () => {
    const client = createClient([
      doc({ id: "society_doc", category: "bylaws#society:society" }),
      doc({ id: "a101_doc", category: "noc#flat:A-101" }),
      doc({ id: "b202_doc", category: "noc#flat:B-202" }),
      doc({ id: "personal_u1", category: "general#personal:u1" }),
      doc({ id: "personal_u2", category: "general#personal:u2" }),
    ]);
    const repository = new DocumentRepository(client);

    const resident = await repository.listDocuments("society_a", {
      userId: "u1",
      flatNumber: "A-101",
      isManager: false,
    });
    expect(resident.map((d) => d.id).sort()).toEqual(["a101_doc", "personal_u1", "society_doc"]);

    const manager = await repository.listDocuments("society_a", {
      userId: "c1",
      isManager: true,
    });
    expect(manager.map((d) => d.id).sort()).toEqual(["a101_doc", "b202_doc", "society_doc"]);
  });
});
