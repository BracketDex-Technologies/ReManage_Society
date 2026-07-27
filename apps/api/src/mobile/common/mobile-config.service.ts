import { Injectable } from "@nestjs/common";

export interface MobileRuntimeConfig {
  enabled: boolean;
  betaSocietyId: string;
  accessTokenSecret: string;
  refreshTokenPepper: string;
  otpPepper: string;
  accessTokenTtlSeconds: 600;
  renewableTtlDays: 30;
  otpTtlSeconds: 300;
  otpMaxAttempts: 5;
}

const MIN_SECRET_LENGTH = 32;

export function readMobileRuntimeConfig(
  source: NodeJS.ProcessEnv = process.env,
): MobileRuntimeConfig {
  if (source.MOBILE_API_ENABLED?.trim() !== "true") {
    throw new Error("Mobile API is disabled");
  }

  return {
    enabled: true,
    betaSocietyId: requiredValue(source, "MOBILE_BETA_SOCIETY_ID"),
    accessTokenSecret: requiredSecret(source, "MOBILE_ACCESS_TOKEN_SECRET"),
    refreshTokenPepper: requiredSecret(source, "MOBILE_REFRESH_TOKEN_PEPPER"),
    otpPepper: requiredSecret(source, "MOBILE_OTP_PEPPER"),
    accessTokenTtlSeconds: 600,
    renewableTtlDays: 30,
    otpTtlSeconds: 300,
    otpMaxAttempts: 5,
  };
}

function requiredValue(source: NodeJS.ProcessEnv, key: string): string {
  const value = source[key]?.trim() ?? "";
  if (!value) {
    throw new Error(`${key} is required when MOBILE_API_ENABLED=true`);
  }
  return value;
}

function requiredSecret(source: NodeJS.ProcessEnv, key: string): string {
  const value = requiredValue(source, key);
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${key} must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return value;
}

@Injectable()
export class MobileConfigService {
  readonly value: MobileRuntimeConfig;

  constructor(source: NodeJS.ProcessEnv = process.env) {
    this.value = readMobileRuntimeConfig(source);
  }
}
