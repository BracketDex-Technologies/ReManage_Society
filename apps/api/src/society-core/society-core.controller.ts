import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  DirectoryPerson,
  ImportRowInput,
  OccupancyMoveInput,
  SocietySetupInput,
} from "../../../../packages/society-core/src/index.ts";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import type { CredentialIssueInput } from "./society-core.repository.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { SocietyCoreService } from "./society-core.service.js";

interface SocietyDirectoryRequest {
  societyId: string;
  people: DirectoryPerson[];
}

interface ImportDryRunRequest {
  societyId: string;
  rows: ImportRowInput[];
}

interface SocietyDirectoryReadRequest {
  societyId: string;
}

@ApiTags("society-core")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/society-core")
export class SocietyCoreController {
  constructor(private readonly societyCore: SocietyCoreService) {}

  @Post("setup-plan")
  @ApiOkResponse({ description: "Returns a validated society setup plan." })
  createSetupPlan(@Req() request: AuthenticatedApiRequest, @Body() body: SocietySetupInput) {
    return this.societyCore.createSetupPlan(this.requirePrincipal(request), body);
  }

  @Post("setup")
  @ApiOkResponse({ description: "Persists a validated society setup plan." })
  commitSetupPlan(@Req() request: AuthenticatedApiRequest, @Body() body: SocietySetupInput) {
    return this.societyCore.commitSetupPlan(this.requirePrincipal(request), body);
  }

  @Post("imports/dry-run")
  @ApiOkResponse({ description: "Validates society core import rows without persisting them." })
  dryRunImport(@Req() request: AuthenticatedApiRequest, @Body() body: ImportDryRunRequest) {
    return this.societyCore.dryRunImport(
      this.requirePrincipal(request),
      body.societyId,
      body.rows,
    );
  }

  @Post("imports/commit")
  @ApiOkResponse({ description: "Commits validated society core import rows." })
  commitImportRows(@Req() request: AuthenticatedApiRequest, @Body() body: ImportDryRunRequest) {
    return this.societyCore.commitImportRows(
      this.requirePrincipal(request),
      body.societyId,
      body.rows,
    );
  }

  @Post("occupancy/move-plan")
  @ApiOkResponse({ description: "Returns an auditable occupancy move plan." })
  planOccupancyMove(@Req() request: AuthenticatedApiRequest, @Body() body: OccupancyMoveInput) {
    return this.societyCore.planOccupancyMove(this.requirePrincipal(request), body);
  }

  @Post("occupancy/commit")
  @ApiOkResponse({ description: "Persists an auditable occupancy move." })
  commitOccupancyMove(@Req() request: AuthenticatedApiRequest, @Body() body: OccupancyMoveInput) {
    return this.societyCore.commitOccupancyMove(this.requirePrincipal(request), body);
  }

  @Post("credentials/issue")
  @ApiOkResponse({ description: "Issues a local credential account for a Phase 3 person record." })
  issueCredential(@Req() request: AuthenticatedApiRequest, @Body() body: CredentialIssueInput) {
    return this.societyCore.issueCredential(this.requirePrincipal(request), body);
  }

  @Post("directory")
  @ApiOkResponse({ description: "Returns a privacy-filtered resident directory." })
  buildDirectory(@Req() request: AuthenticatedApiRequest, @Body() body: SocietyDirectoryRequest) {
    return this.societyCore.buildDirectory(
      this.requirePrincipal(request),
      body.societyId,
      body.people,
    );
  }

  @Post("directory/read")
  @ApiOkResponse({ description: "Reads the privacy-filtered resident directory from persisted data." })
  readDirectory(@Req() request: AuthenticatedApiRequest, @Body() body: SocietyDirectoryReadRequest) {
    return this.societyCore.readDirectory(this.requirePrincipal(request), body.societyId);
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
