import { Injectable } from "@nestjs/common";
import type {
  AuthenticatedPrincipal,
  PlatformRole,
  SocietyRole,
} from "../../../../packages/security/src/index.ts";
import {
  instantiateLegalChecklist,
  listLegalChecklistTemplates,
} from "../../../../packages/community-core/src/index.ts";
import { FileStoragePolicyService } from "../security/file-storage-policy.service.js";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import { DocumentRepository, type CreateDocumentCommand } from "./document.repository.js";

const MANAGER_ROLES: readonly (SocietyRole | PlatformRole)[] = [
  "committee",
  "society_admin",
  "platform_admin",
];

export interface DocumentUploadIntentCommand {
  societyId: string;
  fileName: string;
  contentType: string;
  actorId: string;
}

export interface ListDocumentsCommand {
  societyId: string;
  userId: string;
  flatNumber?: string;
}

@Injectable()
export class DocumentService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly fileStorage: FileStoragePolicyService = new FileStoragePolicyService(),
    private readonly repository: DocumentRepository = new DocumentRepository(),
  ) {}

  createUploadIntent(principal: AuthenticatedPrincipal, command: DocumentUploadIntentCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:document.manage", command.societyId);
    return this.fileStorage.createUploadIntent({
      societyId: command.societyId,
      actorId: command.actorId,
      fileName: command.fileName,
      contentType: command.contentType,
    });
  }

  async createDocument(principal: AuthenticatedPrincipal, command: CreateDocumentCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:document.manage", command.societyId);
    return this.repository.createDocument(command);
  }

  listLegalTemplates(principal: AuthenticatedPrincipal, societyId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return listLegalChecklistTemplates();
  }

  instantiateLegalChecklist(
    principal: AuthenticatedPrincipal,
    societyId: string,
    templateId: string,
  ) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return instantiateLegalChecklist(templateId);
  }

  async listDocuments(principal: AuthenticatedPrincipal, command: ListDocumentsCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", command.societyId);
    return this.repository.listDocuments(command.societyId, {
      userId: command.userId,
      flatNumber: command.flatNumber,
      isManager: this.isManager(principal, command.societyId),
    });
  }

  private isManager(principal: AuthenticatedPrincipal, societyId: string): boolean {
    if (principal.platformRoles.includes("platform_admin")) {
      return true;
    }

    const membership = principal.memberships.find((m) => m.societyId === societyId);
    return Boolean(membership?.roles.some((role) => MANAGER_ROLES.includes(role)));
  }
}
