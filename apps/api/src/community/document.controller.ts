import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { DocumentService } from "./document.service.js";

interface UploadIntentBody {
  societyId: string;
  fileName: string;
  contentType: string;
  actorId: string;
}

interface CreateDocumentBody {
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

interface ListDocumentsBody {
  societyId: string;
  userId: string;
  flatNumber?: string;
}

interface LegalTemplatesBody {
  societyId: string;
}

interface InstantiateLegalChecklistBody {
  societyId: string;
  templateId: string;
}

@ApiTags("community")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/community")
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Post("documents/upload-intent")
  @ApiOkResponse({ description: "Returns a private storage signed upload intent for a document." })
  uploadIntent(@Req() request: AuthenticatedApiRequest, @Body() body: UploadIntentBody) {
    return this.documents.createUploadIntent(this.requirePrincipal(request), body);
  }

  @Post("documents/create")
  @ApiOkResponse({ description: "Registers an uploaded document with scope and category." })
  create(@Req() request: AuthenticatedApiRequest, @Body() body: CreateDocumentBody) {
    return this.documents.createDocument(this.requirePrincipal(request), body);
  }

  @Post("documents/list")
  @ApiOkResponse({ description: "Lists documents visible to the viewer's scope." })
  list(@Req() request: AuthenticatedApiRequest, @Body() body: ListDocumentsBody) {
    return this.documents.listDocuments(this.requirePrincipal(request), body);
  }

  @Post("documents/legal-templates")
  @ApiOkResponse({ description: "Lists non-advisory legal/process checklist templates." })
  legalTemplates(@Req() request: AuthenticatedApiRequest, @Body() body: LegalTemplatesBody) {
    return this.documents.listLegalTemplates(this.requirePrincipal(request), body.societyId);
  }

  @Post("documents/legal-templates/instantiate")
  @ApiOkResponse({ description: "Instantiates a non-advisory legal checklist from a template." })
  instantiateLegalChecklist(
    @Req() request: AuthenticatedApiRequest,
    @Body() body: InstantiateLegalChecklistBody,
  ) {
    return this.documents.instantiateLegalChecklist(
      this.requirePrincipal(request),
      body.societyId,
      body.templateId,
    );
  }

  private requirePrincipal(request: AuthenticatedApiRequest): AuthenticatedPrincipal {
    if (!request.principal) {
      throw new UnauthorizedException({
        error: "unauthorized",
        reason: "Authenticated principal is required",
      });
    }

    return request.principal;
  }
}
