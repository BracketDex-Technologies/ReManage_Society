import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { VisitorService } from "./visitor.service.js";

interface VisitorLogBody {
  societyId: string;
  flatNumber: string;
  flatId?: string;
  visitorName: string;
  phone?: string;
  purpose: string;
  vehicleNo?: string;
  isPreApproved?: boolean;
  arrivedAt: string;
  passcode?: string;
  guardId?: string;
}

interface VisitorRespondBody {
  societyId: string;
  visitorId: string;
  decision: "approve" | "reject";
  respondedAt: string;
  residentResponse?: string;
}

interface VisitorTransitionBody {
  societyId: string;
  visitorId: string;
  action: "enter" | "exit" | "cancel";
  at: string;
}

interface VisitorListBody {
  societyId: string;
  status?: string;
}

interface PatrolScanBody {
  societyId: string;
  guardId: string;
  checkpoint: string;
  scannedAt: string;
  notes?: string;
  photoUrl?: string;
}

interface PatrolListBody {
  societyId: string;
}

@ApiTags("operations")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/operations")
export class VisitorController {
  constructor(private readonly visitors: VisitorService) {}

  @Post("visitors/log")
  @ApiOkResponse({ description: "Logs a gate visitor arrival." })
  logVisitor(@Req() request: AuthenticatedApiRequest, @Body() body: VisitorLogBody) {
    return this.visitors.logVisitor(this.requirePrincipal(request), {
      societyId: body.societyId,
      flatNumber: body.flatNumber,
      flatId: body.flatId,
      visitorName: body.visitorName,
      phone: body.phone,
      purpose: body.purpose,
      vehicleNo: body.vehicleNo,
      isPreApproved: body.isPreApproved,
      arrivedAt: new Date(body.arrivedAt),
      passcode: body.passcode,
      guardId: body.guardId,
    });
  }

  @Post("visitors/respond")
  @ApiOkResponse({ description: "Records a resident approve/reject response." })
  respondToVisitor(@Req() request: AuthenticatedApiRequest, @Body() body: VisitorRespondBody) {
    return this.visitors.respondToVisitor(this.requirePrincipal(request), {
      societyId: body.societyId,
      visitorId: body.visitorId,
      decision: body.decision,
      respondedAt: new Date(body.respondedAt),
      residentResponse: body.residentResponse,
    });
  }

  @Post("visitors/transition")
  @ApiOkResponse({ description: "Marks a visitor entry, exit, or cancellation." })
  transitionVisitor(@Req() request: AuthenticatedApiRequest, @Body() body: VisitorTransitionBody) {
    return this.visitors.transitionVisitor(this.requirePrincipal(request), {
      societyId: body.societyId,
      visitorId: body.visitorId,
      action: body.action,
      at: new Date(body.at),
    });
  }

  @Post("visitors/list")
  @ApiOkResponse({ description: "Lists society visitors." })
  listVisitors(@Req() request: AuthenticatedApiRequest, @Body() body: VisitorListBody) {
    return this.visitors.listVisitors(this.requirePrincipal(request), body.societyId, body.status);
  }

  @Post("patrol/scan")
  @ApiOkResponse({ description: "Records a guard patrol checkpoint scan." })
  scanPatrol(@Req() request: AuthenticatedApiRequest, @Body() body: PatrolScanBody) {
    return this.visitors.scanPatrol(this.requirePrincipal(request), {
      societyId: body.societyId,
      guardId: body.guardId,
      checkpoint: body.checkpoint,
      scannedAt: new Date(body.scannedAt),
      notes: body.notes,
      photoUrl: body.photoUrl,
    });
  }

  @Post("patrol/list")
  @ApiOkResponse({ description: "Lists guard patrol scans." })
  listPatrols(@Req() request: AuthenticatedApiRequest, @Body() body: PatrolListBody) {
    return this.visitors.listPatrols(this.requirePrincipal(request), body.societyId);
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
