import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, Req, UseFilters, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { MobileAuthenticatedRequest } from "../common/mobile-request.ts";
import { MobileProblemFilter } from "../common/mobile-problem.filter.ts";
import { MobileSessionGuard } from "../session/mobile-session.guard.ts";
import {
  MobileGuardOverviewDto,
  MobileGuardPasscodeResultDto,
  MobileGuardVisitorDto,
  RequestVisitorDto,
  VerifyVisitorPasscodeDto,
} from "./dto/mobile-guard.dto.ts";
import { MobileGuardService } from "./mobile-guard.service.ts";

@ApiTags("mobile-guard")
@ApiBearerAuth()
@UseFilters(MobileProblemFilter)
@UseGuards(MobileSessionGuard)
@Controller("api/mobile/v1/guard")
export class MobileGuardController {
  constructor(
    @Inject(MobileGuardService)
    private readonly guards: MobileGuardService,
  ) {}

  @Get("gate/overview")
  @ApiOkResponse({ type: MobileGuardOverviewDto })
  overview(@Req() request: MobileAuthenticatedRequest): Promise<MobileGuardOverviewDto> {
    return this.guards.overview(requireGuardSession(request));
  }

  @Get("visitors")
  @ApiOkResponse({ type: MobileGuardVisitorDto, isArray: true })
  listVisitors(
    @Req() request: MobileAuthenticatedRequest,
    @Query("status") status?: string,
  ): Promise<MobileGuardVisitorDto[]> {
    return this.guards.listVisitors(requireGuardSession(request), status);
  }

  @Post("visitors")
  @ApiBody({ type: RequestVisitorDto })
  @ApiCreatedResponse({ type: MobileGuardVisitorDto })
  requestVisitor(
    @Req() request: MobileAuthenticatedRequest,
    @Body() body: RequestVisitorDto,
  ): Promise<MobileGuardVisitorDto> {
    return this.guards.requestVisitor(requireGuardSession(request), body);
  }

  @Get("visitors/:visitorId")
  @ApiParam({ name: "visitorId", required: true, type: String })
  @ApiOkResponse({ type: MobileGuardVisitorDto })
  getVisitor(
    @Req() request: MobileAuthenticatedRequest,
    @Param("visitorId") visitorId: string,
  ): Promise<MobileGuardVisitorDto> {
    return this.guards.getVisitor(requireGuardSession(request), visitorId);
  }

  @Post("visitors/:visitorId/verify-passcode")
  @ApiParam({ name: "visitorId", required: true, type: String })
  @ApiBody({ type: VerifyVisitorPasscodeDto })
  @ApiOkResponse({ type: MobileGuardPasscodeResultDto })
  verifyPasscode(
    @Req() request: MobileAuthenticatedRequest,
    @Param("visitorId") visitorId: string,
    @Body() body: VerifyVisitorPasscodeDto,
  ): Promise<MobileGuardPasscodeResultDto> {
    return this.guards.verifyPasscode(requireGuardSession(request), visitorId, body);
  }

  @Post("visitors/:visitorId/check-in")
  @ApiParam({ name: "visitorId", required: true, type: String })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileGuardVisitorDto })
  checkIn(
    @Req() request: MobileAuthenticatedRequest,
    @Param("visitorId") visitorId: string,
  ): Promise<MobileGuardVisitorDto> {
    return this.guards.checkIn(requireGuardSession(request), visitorId);
  }

  @Post("visitors/:visitorId/check-out")
  @ApiParam({ name: "visitorId", required: true, type: String })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileGuardVisitorDto })
  checkOut(
    @Req() request: MobileAuthenticatedRequest,
    @Param("visitorId") visitorId: string,
  ): Promise<MobileGuardVisitorDto> {
    return this.guards.checkOut(requireGuardSession(request), visitorId);
  }
}

function requireGuardSession(request: MobileAuthenticatedRequest): NonNullable<MobileAuthenticatedRequest["mobileSession"]> {
  if (!request.mobileSession) throw new Error("MobileSessionGuard did not attach a session");
  return request.mobileSession;
}
