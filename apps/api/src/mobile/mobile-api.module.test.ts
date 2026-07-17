import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../../../packages/db/src/index.ts";
import { AuditLogService } from "../security/audit-log.service.ts";
import { MobileAuthController } from "./auth/mobile-auth.controller.ts";
import { MobileSessionController } from "./session/mobile-session.controller.ts";
import {
  MOBILE_IDENTITY_CLIENT,
  MobileIdentityRepository,
} from "./auth/mobile-identity.repository.ts";
import { MOBILE_API_PROVIDERS } from "./mobile-api.module.ts";

const ENV_KEYS = [
  "DATABASE_URL",
  "MOBILE_API_ENABLED",
  "MOBILE_BETA_SOCIETY_ID",
  "MOBILE_ACCESS_TOKEN_SECRET",
  "MOBILE_REFRESH_TOKEN_PEPPER",
  "MOBILE_OTP_PEPPER",
] as const;

@Module({
  controllers: [MobileAuthController, MobileSessionController],
  providers: [
    ...MOBILE_API_PROVIDERS,
    {
      provide: AuditLogService,
      useValue: { record: async () => undefined },
    },
  ],
})
class FocusedMobileApiTestModule {}

describe("MobileApiModule", () => {
  const originalEnvironment = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/remanage_test";
    process.env.MOBILE_API_ENABLED = "true";
    process.env.MOBILE_BETA_SOCIETY_ID = "society_beta";
    process.env.MOBILE_ACCESS_TOKEN_SECRET =
      "mobile-access-secret-with-at-least-32-characters";
    process.env.MOBILE_REFRESH_TOKEN_PEPPER =
      "refresh-pepper-with-at-least-32-characters";
    process.env.MOBILE_OTP_PEPPER =
      "mobile-otp-pepper-with-at-least-32-characters";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("compiles and resolves the mobile identity provider and controller", async () => {
    const application = await NestFactory.createApplicationContext(
      FocusedMobileApiTestModule,
      {
        abortOnError: false,
        logger: false,
      },
    );

    try {
      expect(application.get(MobileIdentityRepository)).toBeInstanceOf(
        MobileIdentityRepository,
      );
      expect(application.get(MobileAuthController)).toBeInstanceOf(
        MobileAuthController,
      );
      expect(application.get(MobileSessionController)).toBeInstanceOf(
        MobileSessionController,
      );
      expect(application.get(MOBILE_IDENTITY_CLIENT)).toBe(prisma);
    } finally {
      await application.close();
    }
  });
});
