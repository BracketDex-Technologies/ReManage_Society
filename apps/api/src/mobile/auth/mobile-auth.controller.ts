import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseFilters,
} from "@nestjs/common";
import { ApiAcceptedResponse, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { MobileSessionIssueDto } from "../session/dto/mobile-session.dto.ts";
import {
  OtpRequestAcceptedDto,
  OtpRequestDto,
  OtpVerifyDto,
  PasswordLoginRequestDto,
} from "./dto/mobile-auth.dto.ts";
import { MobileAuthService } from "./mobile-auth.service.ts";
import { MobileOtpService } from "./mobile-otp.service.ts";
import { MobileProblemFilter } from "../common/mobile-problem.filter.ts";

@ApiTags("mobile-auth")
@UseFilters(MobileProblemFilter)
@Controller("api/mobile/v1/auth")
export class MobileAuthController {
  @Inject(MobileOtpService)
  private readonly otp!: MobileOtpService;

  constructor(
    @Inject(MobileAuthService)
    private readonly auth: MobileAuthService,
  ) {}

  @Post("password")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: PasswordLoginRequestDto })
  @ApiOkResponse({ type: MobileSessionIssueDto })
  password(
    @Req() request: FastifyRequest,
    @Body() body: PasswordLoginRequestDto,
  ): Promise<MobileSessionIssueDto> {
    return this.auth.passwordLogin(body, {
      networkAddress: request.ip,
      requestId: resolveRequestId(request),
    });
  }

  @Post("otp/request")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: OtpRequestDto })
  @ApiAcceptedResponse({ type: OtpRequestAcceptedDto })
  requestOtp(
    @Req() request: FastifyRequest,
    @Body() body: OtpRequestDto,
  ): Promise<OtpRequestAcceptedDto> {
    return this.otp.requestOtp(body, {
      networkAddress: request.ip,
      requestId: resolveRequestId(request),
    });
  }

  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: OtpVerifyDto })
  @ApiOkResponse({ type: MobileSessionIssueDto })
  verifyOtp(@Body() body: OtpVerifyDto): Promise<MobileSessionIssueDto> {
    return this.otp.verifyOtp(body);
  }
}

function resolveRequestId(request: FastifyRequest): string {
  if (typeof request.id === "string" && request.id.trim()) return request.id;
  return randomUUID();
}
