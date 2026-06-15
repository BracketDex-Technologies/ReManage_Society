import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.ts";

function validEnv(): Record<string, string> {
  return {
    NODE_ENV: "test",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_API_URL: "http://localhost:4000",
    SESSION_SECRET: "local-session-secret",
    POSTGRES_DB: "society_connect",
    POSTGRES_USER: "society",
    POSTGRES_PASSWORD: "society",
    POSTGRES_PORT: "5432",
    DATABASE_URL: "postgresql://society:society@localhost:5432/society_connect",
    DIRECT_URL: "postgresql://society:society@localhost:5432/society_connect",
    API_PORT: "4000",
    API_CORS_ORIGIN: "http://localhost:3000",
    WORKER_CONCURRENCY: "5",
    KEYCLOAK_PORT: "8080",
    KEYCLOAK_ADMIN: "admin",
    KEYCLOAK_ADMIN_PASSWORD: "admin",
    KEYCLOAK_BASE_URL: "http://localhost:8080",
    KEYCLOAK_ISSUER_URL: "http://localhost:8080/realms/society-connect",
    KEYCLOAK_JWKS_URL: "http://localhost:8080/realms/society-connect/protocol/openid-connect/certs",
    KEYCLOAK_REALM: "society-connect",
    KEYCLOAK_CLIENT_ID: "society-connect-web",
    VALKEY_PORT: "6379",
    VALKEY_URL: "redis://localhost:6379",
    MINIO_API_PORT: "9000",
    MINIO_CONSOLE_PORT: "9001",
    MINIO_ROOT_USER: "minioadmin",
    MINIO_ROOT_PASSWORD: "minioadmin",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "local",
    S3_BUCKET: "society-connect-local",
    S3_ACCESS_KEY_ID: "minioadmin",
    S3_SECRET_ACCESS_KEY: "minioadmin",
    S3_FORCE_PATH_STYLE: "true",
    API_SECURITY_HEADERS_ENABLED: "true",
    API_AUDIT_LOGGING_ENABLED: "true",
    OTEL_SERVICE_NAME: "society-connect",
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
  };
}

describe("Phase 2 environment contract", () => {
  it("requires OIDC validation endpoints for API identity checks", () => {
    const source = validEnv();
    delete source.KEYCLOAK_ISSUER_URL;
    delete source.KEYCLOAK_JWKS_URL;

    const result = validateEnv(source);

    expect(result.issues).toEqual([
      { key: "KEYCLOAK_ISSUER_URL", message: "is required" },
      { key: "KEYCLOAK_JWKS_URL", message: "is required" },
    ]);
  });

  it("parses strict security and audit feature switches", () => {
    const result = validateEnv(validEnv());

    expect(result.issues).toEqual([]);
    expect(result.env.API_SECURITY_HEADERS_ENABLED).toBe(true);
    expect(result.env.API_AUDIT_LOGGING_ENABLED).toBe(true);
  });
});
