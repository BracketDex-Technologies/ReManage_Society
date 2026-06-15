import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { PackageService } from "./package.service.js";

interface PackageIntakeBody {
  societyId: string;
  flatId: string;
  courierName?: string;
  description?: string;
  photoUrl?: string;
  loggedBy: string;
  receivedAt: string;
}

interface PackageNotifyBody {
  societyId: string;
  packageId: string;
  flatId: string;
  notifiedAt: string;
}

interface PackageCollectBody {
  societyId: string;
  packageId: string;
  providedOtp: string;
  collectedBy: string;
  collectedAt: string;
}

interface PackageTransitionBody {
  societyId: string;
  packageId: string;
  action: "return" | "mark_lost";
}

interface PackageListBody {
  societyId: string;
  status?: string;
}

@ApiTags("operations")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/operations/packages")
export class PackageController {
  constructor(private readonly packages: PackageService) {}

  @Post("intake")
  @ApiOkResponse({ description: "Logs a package received at the gate." })
  intake(@Req() request: AuthenticatedApiRequest, @Body() body: PackageIntakeBody) {
    return this.packages.intakePackage(this.requirePrincipal(request), {
      societyId: body.societyId,
      flatId: body.flatId,
      courierName: body.courierName,
      description: body.description,
      photoUrl: body.photoUrl,
      loggedBy: body.loggedBy,
      receivedAt: new Date(body.receivedAt),
    });
  }

  @Post("notify")
  @ApiOkResponse({ description: "Notifies the resident a package has arrived." })
  notify(@Req() request: AuthenticatedApiRequest, @Body() body: PackageNotifyBody) {
    return this.packages.notifyPackage(this.requirePrincipal(request), {
      societyId: body.societyId,
      packageId: body.packageId,
      flatId: body.flatId,
      notifiedAt: new Date(body.notifiedAt),
    });
  }

  @Post("collect")
  @ApiOkResponse({ description: "Hands over a package after OTP verification." })
  collect(@Req() request: AuthenticatedApiRequest, @Body() body: PackageCollectBody) {
    return this.packages.collectPackage(this.requirePrincipal(request), {
      societyId: body.societyId,
      packageId: body.packageId,
      providedOtp: body.providedOtp,
      collectedBy: body.collectedBy,
      collectedAt: new Date(body.collectedAt),
    });
  }

  @Post("transition")
  @ApiOkResponse({ description: "Marks a package returned or lost." })
  transition(@Req() request: AuthenticatedApiRequest, @Body() body: PackageTransitionBody) {
    return this.packages.transitionPackage(this.requirePrincipal(request), {
      societyId: body.societyId,
      packageId: body.packageId,
      action: body.action,
    });
  }

  @Post("list")
  @ApiOkResponse({ description: "Lists society packages." })
  list(@Req() request: AuthenticatedApiRequest, @Body() body: PackageListBody) {
    return this.packages.listPackages(this.requirePrincipal(request), body.societyId, body.status);
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
