import type { EnvSource } from "./env.ts";
import { validateEnv } from "./env.ts";

export type ReadinessSeverity = "blocker" | "warning";

export interface ReadinessIssue {
  key: string;
  message: string;
  severity: ReadinessSeverity;
  manual?: boolean;
}

export interface ProductionReadinessResult {
  ready: boolean;
  blockers: readonly ReadinessIssue[];
  warnings: readonly ReadinessIssue[];
  issues: readonly ReadinessIssue[];
}

const PLACEHOLDER_PATTERNS = [
  /^replace-with/i,
  /^changeme/i,
  /^your[-_]/i,
  /^example\.com$/i,
  /^admin@example\.com$/i,
  /^minioadmin$/i,
  /^society$/i,
];

const WEAK_SECRET_KEYS = [
  "SESSION_SECRET",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "API_BFF_BRIDGE_SECRET",
  "KEYCLOAK_CLIENT_SECRET",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "S3_SECRET_ACCESS_KEY",
  "VAPID_PRIVATE_KEY",
] as const;

const MIN_SECRET_LENGTH = 32;

function isProduction(source: EnvSource): boolean {
  return source.NODE_ENV === "production";
}

function isTruthyFlag(source: EnvSource, key: string): boolean {
  return source[key] === "true";
}

function looksLikePlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function addIssue(
  issues: ReadinessIssue[],
  key: string,
  message: string,
  severity: ReadinessSeverity,
  manual = false,
): void {
  issues.push({ key, message, severity, manual });
}

export function validateProductionReadiness(
  source: EnvSource = process.env,
): ProductionReadinessResult {
  const issues: ReadinessIssue[] = [];

  if (!isProduction(source)) {
    addIssue(
      issues,
      "NODE_ENV",
      "Set NODE_ENV=production before running production readiness checks.",
      "warning",
    );
  }

  const envResult = validateEnv(source);
  for (const issue of envResult.issues) {
    addIssue(issues, issue.key, issue.message, "blocker");
  }

  if (envResult.issues.length > 0) {
    return finalize(issues);
  }

  for (const key of WEAK_SECRET_KEYS) {
    const value = String(source[key] ?? "").trim();
    if (!value) continue;
    if (value.length < MIN_SECRET_LENGTH) {
      addIssue(
        issues,
        key,
        `must be at least ${MIN_SECRET_LENGTH} characters in production`,
        "blocker",
      );
    }
    if (looksLikePlaceholder(value)) {
      addIssue(issues, key, "must not use placeholder or default values in production", "blocker");
    }
  }

  if (!isTruthyFlag(source, "TENANT_RLS_ENABLED")) {
    addIssue(
      issues,
      "TENANT_RLS_ENABLED",
      "Enable PostgreSQL tenant RLS (run npm run db:rls:apply, then set TENANT_RLS_ENABLED=true)",
      "blocker",
      true,
    );
  }

  if (!isTruthyFlag(source, "API_BFF_BRIDGE_ENABLED")) {
    addIssue(
      issues,
      "API_BFF_BRIDGE_ENABLED",
      "Enable the BFF→Nest bridge so legacy routes proxy through NestJS with verified auth",
      "blocker",
    );
  }

  if (!isTruthyFlag(source, "NEST_SHIM_ENABLED")) {
    addIssue(
      issues,
      "NEST_SHIM_ENABLED",
      "Enable Nest shims so domain traffic routes through the production API layer",
      "blocker",
    );
  }

  if (!isTruthyFlag(source, "API_SECURITY_HEADERS_ENABLED")) {
    addIssue(issues, "API_SECURITY_HEADERS_ENABLED", "Must be true in production", "blocker");
  }

  if (!isTruthyFlag(source, "API_AUDIT_LOGGING_ENABLED")) {
    addIssue(issues, "API_AUDIT_LOGGING_ENABLED", "Must be true in production", "blocker");
  }

  const valkeyUrl = String(source.VALKEY_URL ?? "");
  if (/localhost|127\.0\.0\.1/.test(valkeyUrl)) {
    addIssue(
      issues,
      "VALKEY_URL",
      "Point Valkey at a managed instance for distributed rate limits and job queues",
      "blocker",
      true,
    );
  }

  const databaseUrl = String(source.DATABASE_URL ?? "");
  if (/localhost|127\.0\.0\.1/.test(databaseUrl)) {
    addIssue(
      issues,
      "DATABASE_URL",
      "Use a managed PostgreSQL endpoint (Neon/RDS/Cloud SQL) for production",
      "blocker",
      true,
    );
  }

  if (!String(source.RAZORPAY_KEY_ID ?? "").trim()) {
    addIssue(
      issues,
      "RAZORPAY_KEY_ID",
      "Configure Razorpay live/sandbox keys and complete webhook validation",
      "blocker",
      true,
    );
  }

  if (!String(source.RAZORPAY_WEBHOOK_SECRET ?? "").trim()) {
    addIssue(
      issues,
      "RAZORPAY_WEBHOOK_SECRET",
      "Set Razorpay webhook signing secret after registering the production webhook URL",
      "blocker",
      true,
    );
  }

  if (!String(source.SMTP_URL ?? "").trim()) {
    addIssue(
      issues,
      "SMTP_URL",
      "Configure an email provider (Resend, SES, SendGrid) for transactional notifications",
      "warning",
      true,
    );
  }

  if (!String(source.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim() || !String(source.VAPID_PRIVATE_KEY ?? "").trim()) {
    addIssue(
      issues,
      "VAPID_PRIVATE_KEY",
      "Generate VAPID keys for web push (npx web-push generate-vapid-keys)",
      "warning",
      true,
    );
  }

  if (!String(source.OTEL_EXPORTER_OTLP_ENDPOINT ?? "").trim()) {
    addIssue(
      issues,
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "Wire OpenTelemetry to Grafana/Datadog/Jaeger for traces and metrics",
      "warning",
      true,
    );
  }

  if (looksLikePlaceholder(String(source.KEYCLOAK_ADMIN_PASSWORD ?? ""))) {
    addIssue(
      issues,
      "KEYCLOAK_ADMIN_PASSWORD",
      "Rotate Keycloak admin password; enforce MFA for privileged realm roles",
      "blocker",
      true,
    );
  }

  return finalize(issues);
}

function finalize(issues: readonly ReadinessIssue[]): ProductionReadinessResult {
  const blockers = issues.filter((issue) => issue.severity === "blocker");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    issues,
  };
}

export function assertProductionReady(source: EnvSource = process.env): void {
  if (source.NODE_ENV !== "production") {
    return;
  }

  const result = validateProductionReadiness(source);
  if (!result.ready) {
    const summary = result.blockers
      .map((issue) => `${issue.key}: ${issue.message}`)
      .join("; ");
    throw new Error(`Production readiness check failed: ${summary}`);
  }
}

export const MANUAL_PRODUCTION_CHECKLIST: readonly string[] = [
  "Provision managed PostgreSQL (Neon/RDS) and run prisma migrate deploy",
  "Run npm run db:rls:apply on production DB, then set TENANT_RLS_ENABLED=true",
  "Deploy Valkey/Redis and set VALKEY_URL to the managed endpoint",
  "Deploy MinIO or S3 bucket; configure S3_* env vars with IAM keys",
  "Deploy Keycloak realm; rotate admin password; enforce MFA on treasurer/chairman roles",
  "Register Razorpay webhook URL; set RAZORPAY_* secrets; run sandbox payment UAT",
  "Configure SMTP_URL and SMS provider for notification delivery",
  "Generate VAPID keys and set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY",
  "Set OTEL_EXPORTER_OTLP_ENDPOINT to your observability backend",
  "Run backup drill: scripts/backup/pg-dump then pg-restore on staging",
  "Run load test: npm run load:api against staging (300 concurrent sessions)",
  "Complete docs/staging/uat-checklist.md sign-off for all personas",
  "Execute dependency remediation sprint (drive npm highs to zero)",
  "Complete Keycloak web OIDC migration (retire JWT cookie sessions)",
  "Migrate UI fetches to @society/sdk and retire legacy /api domain routes",
];
