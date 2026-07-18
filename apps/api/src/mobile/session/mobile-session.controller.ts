import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Put, Req, UseFilters, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  LogoutMobileSessionDto,
  MobileBootstrapDto,
  MobileRoleSwitchDto,
  MobileSessionIssueDto,
  RefreshMobileSessionDto,
  UpdateMobileActiveRoleDto,
} from "./dto/mobile-session.dto.ts";
import { MobileSessionService } from "./mobile-session.service.ts";
import type { MobileAuthenticatedRequest } from "../common/mobile-request.ts";
import { MobileSessionGuard } from "./mobile-session.guard.ts";
import { MobileProblemFilter } from "../common/mobile-problem.filter.ts";

@ApiTags("mobile-session")
@UseFilters(MobileProblemFilter)
@Controller("api/mobile/v1/session")
export class MobileSessionController {
  constructor(
    @Inject(MobileSessionService)
    private readonly sessions: MobileSessionService,
  ) {}

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: RefreshMobileSessionDto })
  @ApiOkResponse({ type: MobileSessionIssueDto })
  refresh(@Body() body: RefreshMobileSessionDto): Promise<MobileSessionIssueDto> {
    return this.sessions.refresh(body.renewableCredential);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LogoutMobileSessionDto })
  @ApiOkResponse({ schema: { example: { loggedOut: true } } })
  logout(@Body() body: LogoutMobileSessionDto): Promise<{ loggedOut: true }> {
    return this.sessions.logout(body.renewableCredential);
  }

  @Get("bootstrap")
  @UseGuards(MobileSessionGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileBootstrapDto })
  bootstrap(@Req() request: MobileAuthenticatedRequest): Promise<MobileBootstrapDto> {
    return this.sessions.bootstrap(requireMobileSession(request));
  }

  @Put("active-role")
  @UseGuards(MobileSessionGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: UpdateMobileActiveRoleDto })
  @ApiOkResponse({ type: MobileRoleSwitchDto })
  activeRole(
    @Req() request: MobileAuthenticatedRequest,
    @Body() body: UpdateMobileActiveRoleDto,
  ): Promise<MobileRoleSwitchDto> {
    return this.sessions.switchRole(requireMobileSession(request), body.role, request.id);
  }
}

function requireMobileSession(request: MobileAuthenticatedRequest): NonNullable<MobileAuthenticatedRequest["mobileSession"]> {
  if (!request.mobileSession) throw new Error("MobileSessionGuard did not attach a session");
  return request.mobileSession;
}
