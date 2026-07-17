import { Module, type Provider } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import { SecurityModule } from "../security/security.module.ts";
import { AuditLogService } from "../security/audit-log.service.ts";
import { MobileAuthController } from "./auth/mobile-auth.controller.ts";
import {
  MOBILE_AUTH_AUDIT,
  MobileAuthService,
  MobilePasswordRateLimitService,
} from "./auth/mobile-auth.service.ts";
import {
  MOBILE_IDENTITY_CLIENT,
  MobileIdentityRepository,
} from "./auth/mobile-identity.repository.ts";
import { MOBILE_OTP_DELIVERY } from "./auth/mobile-otp-delivery.ts";
import {
  delayMobileOtpResponse,
  generateMobileOtpCode,
  generateMobileOtpResponseJitter,
  MOBILE_OTP_CHALLENGE_CLIENT,
  MOBILE_OTP_CLOCK,
  MOBILE_OTP_CODE_GENERATOR,
  MOBILE_OTP_RESPONSE_DELAY,
  MOBILE_OTP_RESPONSE_JITTER,
  MobileOtpChallengeRepository,
  MobileOtpRateLimitService,
  MobileOtpService,
} from "./auth/mobile-otp.service.ts";
import { SmtpMobileOtpDeliveryService } from "./auth/smtp-mobile-otp-delivery.service.ts";
import { MobileConfigService } from "./common/mobile-config.service.ts";
import { MobileAccessTokenService } from "./session/mobile-access-token.service.ts";
import { MobileDeviceSessionRepository } from "./session/mobile-device-session.repository.ts";
import { MobileSessionService } from "./session/mobile-session.service.ts";

export const MOBILE_API_PROVIDERS: Provider[] = [
  {
    provide: MobileConfigService,
    useFactory: () => new MobileConfigService(),
  },
  {
    provide: MOBILE_IDENTITY_CLIENT,
    useValue: prisma,
  },
  MobileIdentityRepository,
  {
    provide: MobileDeviceSessionRepository,
    inject: [MobileConfigService],
    useFactory: (config: MobileConfigService) =>
      new MobileDeviceSessionRepository(undefined, config),
  },
  MobileAccessTokenService,
  MobileSessionService,
  MobilePasswordRateLimitService,
  MobileAuthService,
  {
    provide: MOBILE_OTP_CHALLENGE_CLIENT,
    useValue: prisma,
  },
  MobileOtpChallengeRepository,
  MobileOtpRateLimitService,
  {
    provide: MOBILE_OTP_DELIVERY,
    useFactory: () => new SmtpMobileOtpDeliveryService(),
  },
  {
    provide: MOBILE_OTP_CLOCK,
    useValue: () => new Date(),
  },
  {
    provide: MOBILE_OTP_CODE_GENERATOR,
    useValue: generateMobileOtpCode,
  },
  {
    provide: MOBILE_OTP_RESPONSE_DELAY,
    useValue: delayMobileOtpResponse,
  },
  {
    provide: MOBILE_OTP_RESPONSE_JITTER,
    useValue: generateMobileOtpResponseJitter,
  },
  MobileOtpService,
  {
    provide: MOBILE_AUTH_AUDIT,
    useExisting: AuditLogService,
  },
];

@Module({
  imports: [SecurityModule],
  controllers: [MobileAuthController],
  providers: MOBILE_API_PROVIDERS,
})
export class MobileApiModule {}
