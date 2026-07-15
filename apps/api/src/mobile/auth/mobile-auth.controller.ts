import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { MobileSessionIssueDto } from "../session/dto/mobile-session.dto.ts";
import { PasswordLoginRequestDto } from "./dto/mobile-auth.dto.ts";
import { MobileAuthService } from "./mobile-auth.service.ts";

@ApiTags("mobile-auth")
@Controller("api/mobile/v1/auth")
export class MobileAuthController {
  constructor(
    @Inject(MobileAuthService)
    private readonly auth: MobileAuthService,
  ) {}

  @Post("password")
  @HttpCode(HttpStatus.OK)
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
}

function resolveRequestId(request: FastifyRequest): string {
  if (typeof request.id === "string" && request.id.trim()) return request.id;
  return randomUUID();
}
