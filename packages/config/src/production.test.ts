import { describe, expect, it } from "vitest";
import { assertProductionReady, validateProductionReadiness } from "./production.ts";

function productionEnv(): Record<string, string> {
  return {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
    NEXT_PUBLIC_API_URL: "https://api.example.com",
    SESSION_SECRET: "prod-session-secret-with-32-characters-minimum",
    AUTH_SECRET: "prod-auth-secret-with-32-characters-minimum-xx",
    NEXTAUTH_SECRET: "prod-nextauth-secret-32-characters-minimum-x",
    POSTGRES_DB: "society_connect",
    POSTGRES_USER: "society_prod",
    POSTGRES_PASSWORD: "society_prod_password_32_chars_minimum",
    POSTGRES_PORT: "5432",
    DATABASE_URL: "postgresql://user:pass@prod-db.example.com:5432/society_connect?sslmode=require",
    DIRECT_URL: "postgresql://user:pass@prod-db.example.com:5432/society_connect?sslmode=require",
    API_PORT: "4000",
    API_CORS_ORIGIN: "https://app.example.com",
    WORKER_CONCURRENCY: "5",
    KEYCLOAK_PORT: "8080",
    KEYCLOAK_ADMIN: "ops-admin",
    KEYCLOAK_ADMIN_PASSWORD: "keycloak-admin-password-32-characters-min",
    KEYCLOAK_BASE_URL: "https://auth.example.com",
    KEYCLOAK_ISSUER_URL: "https://auth.example.com/realms/society-connect",
    KEYCLOAK_JWKS_URL:
      "https://auth.example.com/realms/society-connect/protocol/openid-connect/certs",
    KEYCLOAK_REALM: "society-connect",
    KEYCLOAK_CLIENT_ID: "society-web",
    KEYCLOAK_CLIENT_SECRET: "keycloak-client-secret-32-characters-minimum",
    API_SECURITY_HEADERS_ENABLED: "true",
    API_AUDIT_LOGGING_ENABLED: "true",
    VALKEY_PORT: "6379",
    VALKEY_URL: "redis://valkey.internal:6379",
    MINIO_API_PORT: "9000",
    MINIO_CONSOLE_PORT: "9001",
    MINIO_ROOT_USER: "storage-admin",
    MINIO_ROOT_PASSWORD: "storage-admin-password-32-characters-min",
    S3_ENDPOINT: "https://s3.example.com",
    S3_REGION: "ap-south-1",
    S3_BUCKET: "society-connect-prod",
    S3_ACCESS_KEY_ID: "AKIAEXAMPLEKEY",
    S3_SECRET_ACCESS_KEY: "s3-secret-access-key-32-characters-minimum",
    S3_FORCE_PATH_STYLE: "false",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BExampleVapidPublicKey",
    VAPID_PRIVATE_KEY: "vapid-private-key-32-characters-minimum-xx",
    VAPID_SUBJECT: "mailto:ops@example.com",
    EMAIL_FROM: "no-reply@example.com",
    SMTP_URL: "smtp://smtp.example.com:587",
    SMS_PROVIDER: "msg91",
    SMS_API_KEY: "sms-api-key-32-characters-minimum-xxx",
    RAZORPAY_KEY_ID: "rzp_live_example",
    RAZORPAY_KEY_SECRET: "razorpay-key-secret-32-characters-minimum",
    RAZORPAY_WEBHOOK_SECRET: "razorpay-webhook-secret-32-characters-min",
    OTEL_SERVICE_NAME: "society-connect",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
    TENANT_RLS_ENABLED: "true",
    API_BFF_BRIDGE_ENABLED: "true",
    API_BFF_BRIDGE_SECRET: "bff-bridge-secret-32-characters-minimum-x",
    NEST_SHIM_ENABLED: "true",
  };
}

describe("production readiness", () => {
  it("passes when production env meets the 10/10 contract", () => {
    const result = validateProductionReadiness(productionEnv());
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("flags missing tenant RLS and bridge flags", () => {
    const source = productionEnv();
    source.TENANT_RLS_ENABLED = "false";
    source.API_BFF_BRIDGE_ENABLED = "false";

    const result = validateProductionReadiness(source);
    expect(result.ready).toBe(false);
    expect(result.blockers.map((issue) => issue.key)).toEqual(
      expect.arrayContaining(["TENANT_RLS_ENABLED", "API_BFF_BRIDGE_ENABLED"]),
    );
  });

  it("rejects placeholder secrets in production", () => {
    const source = productionEnv();
    source.SESSION_SECRET = "replace-with-local-session-secret-32-chars";

    const result = validateProductionReadiness(source);
    expect(result.ready).toBe(false);
    expect(result.blockers.some((issue) => issue.key === "SESSION_SECRET")).toBe(true);
  });

  it("skips assertProductionReady outside production", () => {
    expect(() =>
      assertProductionReady({
        NODE_ENV: "development",
        SESSION_SECRET: "short",
      }),
    ).not.toThrow();
  });

  it("throws assertProductionReady when blockers exist", () => {
    expect(() =>
      assertProductionReady({
        NODE_ENV: "production",
        SESSION_SECRET: "replace-with-local-session-secret-32-chars",
      }),
    ).toThrow(/Production readiness check failed/);
  });
});
