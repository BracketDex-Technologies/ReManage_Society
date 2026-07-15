import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module.ts";
import { AuditLogService } from "../security/audit-log.service.ts";
import { MobileAuthController } from "./auth/mobile-auth.controller.ts";
import {
  MOBILE_AUTH_AUDIT,
  MobileAuthService,
  MobilePasswordRateLimitService,
} from "./auth/mobile-auth.service.ts";
import { MobileIdentityRepository } from "./auth/mobile-identity.repository.ts";
import { MobileConfigService } from "./common/mobile-config.service.ts";
import { MobileAccessTokenService } from "./session/mobile-access-token.service.ts";
import { MobileDeviceSessionRepository } from "./session/mobile-device-session.repository.ts";
import { MobileSessionService } from "./session/mobile-session.service.ts";

@Module({
  imports: [SecurityModule],
  controllers: [MobileAuthController],
  providers: [
    MobileConfigService,
    MobileIdentityRepository,
    MobileDeviceSessionRepository,
    MobileAccessTokenService,
    MobileSessionService,
    MobilePasswordRateLimitService,
    MobileAuthService,
    {
      provide: MOBILE_AUTH_AUDIT,
      useExisting: AuditLogService,
    },
  ],
})
export class MobileApiModule {}
