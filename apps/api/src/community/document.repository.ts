import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  decodeDocumentCategory,
  documentVersionKey,
  encodeDocumentCategory,
  resolveDocumentVisibility,
  type DocumentViewer,
} from "../../../../packages/community-core/src/index.ts";

interface DocumentRecord {
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

export interface DocumentPersistenceClient {
  document: {
    create(input: { data: Record<string, unknown> }): Promise<DocumentRecord>;
    findMany(input: Record<string, unknown>): Promise<DocumentRecord[]>;
  };
}

export interface CreateDocumentCommand {
  societyId: string;
  title: string;
  category?: string;
  scope?: string;
  ownerRef?: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  uploadedBy: string;
}

@Injectable()
export class DocumentRepository {
  constructor(
    private readonly client: DocumentPersistenceClient = prisma as unknown as DocumentPersistenceClient,
  ) {}

  async createDocument(command: CreateDocumentCommand) {
    const encodedCategory = encodeDocumentCategory({
      category: command.category,
      scope: command.scope,
      ownerRef: command.ownerRef,
    });
    const { scope, ownerRef, category } = decodeDocumentCategory(encodedCategory);

    const document = await this.client.document.create({
      data: {
        societyId: command.societyId,
        title: command.title,
        category: encodedCategory,
        fileName: command.fileName,
        fileUrl: command.fileUrl,
        fileSize: command.fileSize ?? null,
        uploadedBy: command.uploadedBy,
      },
    });

    return {
      created: true as const,
      documentId: document.id,
      category,
      scope,
      ownerRef,
      versionKey: documentVersionKey({
        societyId: command.societyId,
        scope,
        ownerRef,
        title: command.title,
      }),
    };
  }

  async listDocuments(societyId: string, viewer: DocumentViewer) {
    const documents = await this.client.document.findMany({
      where: { societyId },
      orderBy: { createdAt: "desc" },
    });

    return documents
      .map((document) => {
        const decoded = decodeDocumentCategory(document.category);
        return {
          id: document.id,
          title: document.title,
          category: decoded.category,
          scope: decoded.scope,
          ownerRef: decoded.ownerRef,
          fileName: document.fileName,
          fileUrl: document.fileUrl,
          fileSize: document.fileSize,
          uploadedBy: document.uploadedBy,
          createdAt: document.createdAt,
        };
      })
      .filter((document) =>
        resolveDocumentVisibility({ scope: document.scope, ownerRef: document.ownerRef, viewer }),
      );
  }
}
