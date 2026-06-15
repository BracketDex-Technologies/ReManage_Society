# Phase 8 Security Assessment

Last updated: 7 June 2026

## Summary

| Area | Status | Notes |
|---|---|---|
| Authentication | Pass (compat) | Keycloak OIDC scaffold + BFF bridge for Next.js shims |
| Authorization | Pass | Central `@society/security` policy; MFA on privileged actions |
| Tenant isolation | Pass | `x-society-id` + membership checks; integration tests |
| Secrets | Pass | `.env` gitignored; CI secret scan |
| Dependencies | Accepted baseline | 0 critical / 13 high / 6 moderate — frozen in `audit-baseline.json` |
| Headers | Partial | API strict CSP; Next.js web CSP still allows `unsafe-inline` (deferred) |
| File storage | Pass (scaffold) | Tenant-scoped keys + presigned URLs |
| Webhooks | Pass (domain) | Razorpay idempotency keys in `finance-core` |
| Audit | Pass (scaffold) | `AuditLogService` + security event model |

**Unresolved critical/high code findings:** none.

**Infrastructure findings (staging-only mitigations):** Valkey rate-limit wiring, RLS SQL apply, live Keycloak MFA enforcement.

## Authentication & authorization

- NestJS API: `AuthenticationGuard` + `CompositeJwtPrincipalVerifier` (Keycloak JWKS + optional BFF bridge).
- Web shell: JWT cookie sessions (compatibility mode); OIDC web migration deferred.
- Privileged actions requiring MFA: `society:finance.manage`, `community:document.manage`, `community:governance.manage`, `operations:manage`, `audit:event.read`, `society:settings.manage`, `society:core.manage`, `society:import.manage`, `society:occupancy.manage`.
- Tests: `tests/integration/mfa-privileged.test.ts`, `tests/integration/cross-tenant.api.test.ts`.

## Tenant isolation

- Request path derives society from authenticated membership; arbitrary `societyId` in body cannot bypass guard.
- PostgreSQL RLS SQL artifact: `packages/db/rls/001-tenant-isolation.sql` (manual staging apply).
- Cross-tenant negative tests cover policy + auth guard.

## Dependency audit

Baseline tracked in `docs/security/audit-baseline.json`. CI runs `npm run audit:gate` — fails only when vulnerability counts **increase** above baseline.

Remediation target: dedicated dependency-audit checkpoint before public launch.

## Headers & CSP

| Surface | CSP |
|---|---|
| NestJS API | Strict — no `unsafe-inline` / `unsafe-eval` (`security-headers.middleware`) |
| Next.js web | Legacy — `unsafe-inline` + `unsafe-eval` for dev/HMR compatibility (deferred) |

## Rate limiting

- API: `RateLimitService` with Valkey store scaffold; in-memory fallback for local dev.
- Staging checklist: wire `VALKEY_URL` before production RC sign-off.

## Critical path test coverage

| Path | Contract / integration test |
|---|---|
| Journal posting idempotency | `tests/contract/finance-critical.test.ts` |
| Payment / webhook keys | `tests/contract/finance-critical.test.ts` |
| Visitor / package dedupe | `tests/contract/operations-critical.test.ts` |
| Notice read / poll vote | `tests/contract/community-critical.test.ts` |
| Import dry-run | `tests/contract/society-critical.test.ts` |
| Cross-tenant deny | `tests/integration/cross-tenant.api.test.ts` |
| MFA deny | `tests/integration/mfa-privileged.test.ts` |

## Accepted risks (review by 2026-09-01)

| Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Transitive npm highs (13) | High | Frozen baseline; no new highs in CI gate | Engineering |
| Next.js CSP unsafe-inline | High (web) | Strict CSP migration post-RC | Engineering |
| JWT web sessions | Medium | Keycloak web shell (deferred) | Product |
| RLS not auto-applied | Medium | Staging operator runbook step | Ops |
| Razorpay live sandbox | Medium | Parallel validation track | Finance |
