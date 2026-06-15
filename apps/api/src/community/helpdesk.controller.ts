import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import type { ComplaintAction } from "../../../../packages/community-core/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { HelpdeskService } from "./helpdesk.service.js";

interface RaiseComplaintBody {
  societyId: string;
  flatNumber: string;
  raisedBy: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  mediaUrls?: string[];
}

interface AssignComplaintBody {
  societyId: string;
  complaintId: string;
  assignedTo: string;
  slaHours?: number;
}

interface TransitionComplaintBody {
  societyId: string;
  complaintId: string;
  action: ComplaintAction;
  resolution?: string;
  at?: string;
}

interface EscalateComplaintBody {
  societyId: string;
  complaintId: string;
}

interface RateComplaintBody {
  societyId: string;
  complaintId: string;
  rating: number;
  comment?: string;
}

interface ListComplaintsBody {
  societyId: string;
  status?: string;
}

@ApiTags("community")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/community")
export class HelpdeskController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Post("helpdesk/raise")
  @ApiOkResponse({ description: "Raises a complaint with default SLA by priority." })
  raise(@Req() request: AuthenticatedApiRequest, @Body() body: RaiseComplaintBody) {
    return this.helpdesk.raiseComplaint(this.requirePrincipal(request), body);
  }

  @Post("helpdesk/assign")
  @ApiOkResponse({ description: "Assigns a complaint to a handler." })
  assign(@Req() request: AuthenticatedApiRequest, @Body() body: AssignComplaintBody) {
    return this.helpdesk.assignComplaint(this.requirePrincipal(request), body);
  }

  @Post("helpdesk/transition")
  @ApiOkResponse({ description: "Transitions a complaint through its lifecycle." })
  transition(@Req() request: AuthenticatedApiRequest, @Body() body: TransitionComplaintBody) {
    return this.helpdesk.transitionComplaint(this.requirePrincipal(request), {
      societyId: body.societyId,
      complaintId: body.complaintId,
      action: body.action,
      resolution: body.resolution,
      at: body.at ? new Date(body.at) : undefined,
    });
  }

  @Post("helpdesk/escalate")
  @ApiOkResponse({ description: "Escalates a complaint to the next tier." })
  escalate(@Req() request: AuthenticatedApiRequest, @Body() body: EscalateComplaintBody) {
    return this.helpdesk.escalateComplaint(this.requirePrincipal(request), body);
  }

  @Post("helpdesk/rate")
  @ApiOkResponse({ description: "Records resident satisfaction on a resolved complaint." })
  rate(@Req() request: AuthenticatedApiRequest, @Body() body: RateComplaintBody) {
    return this.helpdesk.rateComplaint(this.requirePrincipal(request), body);
  }

  @Post("helpdesk/list")
  @ApiOkResponse({ description: "Lists complaints with SLA breach flags." })
  list(@Req() request: AuthenticatedApiRequest, @Body() body: ListComplaintsBody) {
    return this.helpdesk.listComplaints(this.requirePrincipal(request), body.societyId, body.status);
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
