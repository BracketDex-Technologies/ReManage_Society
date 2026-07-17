import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  LogoutMobileSessionDto,
  MobileSessionIssueDto,
  RefreshMobileSessionDto,
} from "./dto/mobile-session.dto.ts";
import { MobileSessionService } from "./mobile-session.service.ts";

@ApiTags("mobile-session")
@Controller("api/mobile/v1/session")
export class MobileSessionController {
  constructor(
    @Inject(MobileSessionService)
    private readonly sessions: MobileSessionService,
  ) {}

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileSessionIssueDto })
  refresh(@Body() body: RefreshMobileSessionDto): Promise<MobileSessionIssueDto> {
    return this.sessions.refresh(body.renewableCredential);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ schema: { example: { loggedOut: true } } })
  logout(@Body() body: LogoutMobileSessionDto): Promise<{ loggedOut: true }> {
    return this.sessions.logout(body.renewableCredential);
  }
}
