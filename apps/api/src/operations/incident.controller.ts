import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { IncidentService } from "./incident.service.js";

interface ReportIncidentBody {
  societyId: string;
  guardId?: string;
  type: string;
  description: string;
  severity?: string;
  reportedBy?: string;
  actionTaken?: string;
}

interface RaiseSosBody {
  societyId: string;
  reportedBy: string;
  description?: string;
  severity?: string;
  raisedAt?: string;
}

interface AddBlacklistBody {
  societyId: string;
  name: string;
  phone?: string;
  reason: string;
  addedBy: string;
}

interface CheckBlacklistBody {
  societyId: string;
  name?: string;
  phone?: string;
}

interface ListIncidentsBody {
  societyId: string;
  status?: string;
}

@ApiTags("operations")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/operations")
export class IncidentController {
  constructor(private readonly incidents: IncidentService) {}

  @Post("incidents/report")
  @ApiOkResponse({ description: "Reports a gate incident." })
  report(@Req() request: AuthenticatedApiRequest, @Body() body: ReportIncidentBody) {
    return this.incidents.reportIncident(this.requirePrincipal(request), body);
  }

  @Post("sos/raise")
  @ApiOkResponse({ description: "Raises an SOS alert and fans out escalation notifications." })
  raiseSos(@Req() request: AuthenticatedApiRequest, @Body() body: RaiseSosBody) {
    return this.incidents.raiseSos(this.requirePrincipal(request), {
      societyId: body.societyId,
      reportedBy: body.reportedBy,
      description: body.description,
      severity: body.severity,
      raisedAt: body.raisedAt ? new Date(body.raisedAt) : new Date(),
    });
  }

  @Post("blacklist/add")
  @ApiOkResponse({ description: "Adds a blacklist entry." })
  addBlacklist(@Req() request: AuthenticatedApiRequest, @Body() body: AddBlacklistBody) {
    return this.incidents.addBlacklist(this.requirePrincipal(request), body);
  }

  @Post("blacklist/check")
  @ApiOkResponse({ description: "Checks a visitor against the blacklist at the gate." })
  checkBlacklist(@Req() request: AuthenticatedApiRequest, @Body() body: CheckBlacklistBody) {
    return this.incidents.checkBlacklist(this.requirePrincipal(request), body);
  }

  @Post("incidents/list")
  @ApiOkResponse({ description: "Lists gate incidents." })
  list(@Req() request: AuthenticatedApiRequest, @Body() body: ListIncidentsBody) {
    return this.incidents.listIncidents(this.requirePrincipal(request), body.societyId, body.status);
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
