export type EnvSource = Record<string, string | undefined>;

type EnvValueType = "boolean" | "integer" | "string" | "url";

export interface EnvRule {
  key: keyof AppEnv;
  description: string;
  required: boolean;
  type: EnvValueType;
  defaultValue?: string;
  allowedValues?: readonly string[];
  min?: number;
}

export interface EnvValidationIssue {
  key: string;
  message: string;
}

export interface AppEnv {
  NODE_ENV: string;
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_API_URL: string;
  SESSION_SECRET: string;
  AUTH_SECRET: string;
  NEXTAUTH_SECRET: string;
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_PORT: number;
  DATABASE_URL: string;
  DIRECT_URL: string;
  API_PORT: number;
  API_CORS_ORIGIN: string;
  WORKER_CONCURRENCY: number;
  KEYCLOAK_PORT: number;
  KEYCLOAK_ADMIN: string;
  KEYCLOAK_ADMIN_PASSWORD: string;
  KEYCLOAK_BASE_URL: string;
  KEYCLOAK_ISSUER_URL: string;
  KEYCLOAK_JWKS_URL: string;
  KEYCLOAK_REALM: string;
  KEYCLOAK_CLIENT_ID: string;
  KEYCLOAK_CLIENT_SECRET: string;
  API_SECURITY_HEADERS_ENABLED: boolean;
  API_AUDIT_LOGGING_ENABLED: boolean;
  VALKEY_PORT: number;
  VALKEY_URL: string;
  MINIO_API_PORT: number;
  MINIO_CONSOLE_PORT: number;
  MINIO_ROOT_USER: string;
  MINIO_ROOT_PASSWORD: string;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  EMAIL_FROM: string;
  SMTP_URL: string;
  SMS_PROVIDER: string;
  SMS_API_KEY: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  OTEL_SERVICE_NAME: string;
  OTEL_EXPORTER_OTLP_ENDPOINT: string;
}

export const ENV_RULES: readonly EnvRule[] = [
  rule("NODE_ENV", "Runtime environment.", true, "string", "development", ["development", "test", "production"]),
  rule("NEXT_PUBLIC_APP_URL", "Public web application URL.", true, "url"),
  rule("NEXT_PUBLIC_API_URL", "Public API URL used by web and mobile clients.", true, "url"),
  rule("SESSION_SECRET", "Current app session secret.", true, "string"),
  rule("AUTH_SECRET", "Auth-compatible secret for future auth libraries.", false, "string", ""),
  rule("NEXTAUTH_SECRET", "NextAuth-compatible secret while dependency remains present.", false, "string", ""),
  rule("POSTGRES_DB", "Local PostgreSQL database name.", true, "string", "society_connect"),
  rule("POSTGRES_USER", "Local PostgreSQL bootstrap user.", true, "string", "society"),
  rule("POSTGRES_PASSWORD", "Local PostgreSQL bootstrap password.", true, "string", "society"),
  rule("POSTGRES_PORT", "Local PostgreSQL host port.", true, "integer", "5432", undefined, 1),
  rule("DATABASE_URL", "Application PostgreSQL connection URL.", true, "url"),
  rule("DIRECT_URL", "Direct PostgreSQL URL used by Prisma migration/generate flows.", true, "url"),
  rule("API_PORT", "NestJS API port.", true, "integer", "4000", undefined, 1),
  rule("API_CORS_ORIGIN", "Allowed web origin for local API CORS.", true, "url"),
  rule("WORKER_CONCURRENCY", "Default worker concurrency.", true, "integer", "5", undefined, 1),
  rule("KEYCLOAK_PORT", "Local Keycloak host port.", true, "integer", "8080", undefined, 1),
  rule("KEYCLOAK_ADMIN", "Local Keycloak bootstrap admin user.", true, "string", "admin"),
  rule("KEYCLOAK_ADMIN_PASSWORD", "Local Keycloak bootstrap admin password.", true, "string", "admin"),
  rule("KEYCLOAK_BASE_URL", "Keycloak base URL.", true, "url"),
  rule("KEYCLOAK_ISSUER_URL", "OIDC issuer URL used to validate API bearer tokens.", true, "url"),
  rule("KEYCLOAK_JWKS_URL", "OIDC JWKS URL used to validate API bearer-token signatures.", true, "url"),
  rule("KEYCLOAK_REALM", "Keycloak realm name.", true, "string"),
  rule("KEYCLOAK_CLIENT_ID", "Keycloak web client ID.", true, "string"),
  rule("KEYCLOAK_CLIENT_SECRET", "Keycloak confidential client secret.", false, "string", ""),
  rule("API_SECURITY_HEADERS_ENABLED", "Enable strict API security headers.", true, "boolean", "true"),
  rule("API_AUDIT_LOGGING_ENABLED", "Enable audit-event emission for privileged API actions.", true, "boolean", "true"),
  rule("VALKEY_PORT", "Local Valkey host port.", true, "integer", "6379", undefined, 1),
  rule("VALKEY_URL", "Valkey connection URL.", true, "url"),
  rule("MINIO_API_PORT", "Local MinIO S3 API host port.", true, "integer", "9000", undefined, 1),
  rule("MINIO_CONSOLE_PORT", "Local MinIO console host port.", true, "integer", "9001", undefined, 1),
  rule("MINIO_ROOT_USER", "Local MinIO bootstrap root user.", true, "string", "minioadmin"),
  rule("MINIO_ROOT_PASSWORD", "Local MinIO bootstrap root password.", true, "string", "minioadmin"),
  rule("S3_ENDPOINT", "S3-compatible object-storage endpoint.", true, "url"),
  rule("S3_REGION", "S3 region identifier.", true, "string"),
  rule("S3_BUCKET", "S3 bucket name.", true, "string"),
  rule("S3_ACCESS_KEY_ID", "S3 access key ID.", true, "string"),
  rule("S3_SECRET_ACCESS_KEY", "S3 secret access key.", true, "string"),
  rule("S3_FORCE_PATH_STYLE", "Whether local S3 uses path-style URLs.", true, "boolean", "true"),
  rule("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "Public VAPID key for browser push.", false, "string", ""),
  rule("VAPID_PRIVATE_KEY", "Private VAPID key for push delivery.", false, "string", ""),
  rule("VAPID_SUBJECT", "VAPID subject email/URL.", false, "string", ""),
  rule("EMAIL_FROM", "Default outbound email sender.", false, "string", ""),
  rule("SMTP_URL", "SMTP provider URL.", false, "string", ""),
  rule("SMS_PROVIDER", "SMS provider identifier.", false, "string", ""),
  rule("SMS_API_KEY", "SMS provider API key.", false, "string", ""),
  rule("RAZORPAY_KEY_ID", "Razorpay public key ID.", false, "string", ""),
  rule("RAZORPAY_KEY_SECRET", "Razorpay key secret.", false, "string", ""),
  rule("RAZORPAY_WEBHOOK_SECRET", "Razorpay webhook signing secret.", false, "string", ""),
  rule("OTEL_SERVICE_NAME", "OpenTelemetry service name.", true, "string", "society-connect"),
  rule("OTEL_EXPORTER_OTLP_ENDPOINT", "OpenTelemetry OTLP endpoint.", false, "url", "http://localhost:4318"),
];

export class EnvValidationError extends Error {
  constructor(readonly issues: readonly EnvValidationIssue[]) {
    super(issues.map((issue) => `${issue.key}: ${issue.message}`).join("; "));
    this.name = "EnvValidationError";
  }
}

export function getEnvContract(): readonly EnvRule[] {
  return ENV_RULES;
}

export function readEnv(source: EnvSource = process.env): AppEnv {
  const result = validateEnv(source);

  if (result.issues.length > 0) {
    throw new EnvValidationError(result.issues);
  }

  return result.env;
}

export function validateEnv(source: EnvSource): { env: AppEnv; issues: readonly EnvValidationIssue[] } {
  const issues: EnvValidationIssue[] = [];
  const values: Partial<AppEnv> = {};

  for (const envRule of ENV_RULES) {
    const rawValue = normalize(source[String(envRule.key)] ?? envRule.defaultValue);

    if (envRule.required && rawValue === "") {
      issues.push({ key: String(envRule.key), message: "is required" });
      continue;
    }

    if (rawValue === "") {
      assignValue(values, envRule.key, coerceOptional(envRule.type));
      continue;
    }

    const parsed = parseValue(rawValue, envRule);
    if (parsed.ok) {
      assignValue(values, envRule.key, parsed.value);
    } else {
      issues.push({ key: String(envRule.key), message: parsed.message });
    }
  }

  return {
    env: values as AppEnv,
    issues,
  };
}

function rule(
  key: keyof AppEnv,
  description: string,
  required: boolean,
  type: EnvValueType,
  defaultValue?: string,
  allowedValues?: readonly string[],
  min?: number
): EnvRule {
  return { key, description, required, type, defaultValue, allowedValues, min };
}

function normalize(value: string | undefined): string {
  return value?.trim() ?? "";
}

function parseValue(
  value: string,
  envRule: EnvRule
): { ok: true; value: boolean | number | string } | { ok: false; message: string } {
  if (envRule.allowedValues && !envRule.allowedValues.includes(value)) {
    return { ok: false, message: `must be one of: ${envRule.allowedValues.join(", ")}` };
  }

  if (envRule.type === "boolean") {
    if (value === "true") return { ok: true, value: true };
    if (value === "false") return { ok: true, value: false };
    return { ok: false, message: "must be true or false" };
  }

  if (envRule.type === "integer") {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return { ok: false, message: "must be an integer" };
    if (envRule.min !== undefined && parsed < envRule.min) {
      return { ok: false, message: `must be greater than or equal to ${envRule.min}` };
    }
    return { ok: true, value: parsed };
  }

  if (envRule.type === "url" && !isValidUrl(value)) {
    return { ok: false, message: "must be a valid URL" };
  }

  return { ok: true, value };
}

function coerceOptional(type: EnvValueType): boolean | number | string {
  if (type === "boolean") return false;
  if (type === "integer") return 0;
  return "";
}

function assignValue<T extends keyof AppEnv>(
  values: Partial<AppEnv>,
  key: T,
  value: AppEnv[T]
): void {
  values[key] = value;
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
