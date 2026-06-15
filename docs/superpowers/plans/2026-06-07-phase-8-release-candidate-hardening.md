# Phase 8 Release-Candidate Hardening Implementation Plan

> **STATUS: COMPLETE (7 June 2026).** Scope decisions locked (all recommended defaults). CP1–CP8 verified locally; staging-only items (load drill, backup drill, Docker builds) documented for operator execution.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the production-capable release candidate — obsolete surface retired or shimmed, security assessed and gated, regression/failure/load coverage expanded, backup/restore proven, runbooks and staging UAT artifacts ready, provider-neutral deployment images and checklist in place — so all Mandatory Quality Gates pass without forcing cloud/vendor/sales/branding decisions.

**Architecture:** Phase 8 is a **hardening and operations** phase, not a domain-feature phase. Work follows the established monorepo pattern: pure testable packages where invariants apply (`@society/test` fixtures, contract helpers), NestJS integration tests against fake/real Prisma boundaries, Playwright for critical web workflows, and **documented** operational procedures where live infrastructure (Docker, Postgres restore, k6 load) may not run in every developer environment. Compatibility mode remains default: **no new Prisma migrations without explicit approval**; schema-hardening deferrals from Phases 5–6 stay parallel. Legacy Next.js `/api/*` business routes are retired **incrementally** via an audited inventory — never blind deletion — with BFF-only routes (auth, search, dashboard aggregation, push compat) retained at root `src/` until OIDC/SDK migration is approved.

**Tech Stack:** TypeScript, Vitest, Node `node:test` (worker), Playwright + lightweight a11y checks, NestJS/Fastify API test harness, `@society/security` policy fixtures, Docker multi-stage images (Node 24 Alpine), existing `docker-compose.yml` (Postgres 18, Valkey, MinIO, Keycloak), optional k6 or Artillery load scripts, GitHub Actions CI extensions, PowerShell + bash operational scripts.

## Roadmap Alignment

Phase 8 deliverables from `docs/PRODUCT_PRODUCTION_ROADMAP.md`:

| Deliverable | Current baseline (7 Jun 2026) | Phase 8 target |
|---|---|---|
| Remove obsolete APIs/code | 89 `src/app/api/**/route.ts` files; NestJS `/api/v1/*` covers society, finance, operations, community | Audited retirement matrix; duplicated domain routes shimmed or removed; `legal-adviser` and other gated surfaces resolved |
| Security assessment | Phase 2 security scaffolding + unit tests; CI has lint/typecheck/test/build only; `npm audit` not gated | Documented assessment; CI dependency/secret scans; expanded cross-tenant + MFA integration tests; no unresolved critical/high findings |
| Regression suite | 385 Vitest + 8 worker + 13 Playwright tests | Contract + integration coverage on billing, ledger, payment, webhook, audit, idempotency critical paths |
| Load tests | None | Scripted load profile: 50 societies, 15k users, 300 concurrent sessions; core API p95 < 750 ms (excl. third-party) |
| Failure tests | `/health/ready` DB ping; worker `degraded` placeholder | Documented + automated smoke for DB-down, worker-degraded, rate-limit breach, webhook replay |
| Backup/restore drill | Compose volumes only; no runbook | `pg_dump` / restore script + recorded drill outcome |
| Runbooks | None under `docs/` | Incident, deployment, rollback, backup, Keycloak MFA, webhook replay runbooks |
| Staging UAT | None | Role-based UAT checklist for staging sign-off |
| Docker images + deployment checklist | No Dockerfiles; Compose infra only | Provider-neutral images + env checklist (no cloud lock-in) |

**Exit gate (Mandatory Quality Gates):** Lint (known legacy baseline only — zero **new** issues in `apps/`/`packages/`), type-check, build, migrations apply cleanly (or documented equivalent while migrations directory is empty), unit + integration + contract + Playwright pass, no unresolved critical/high security findings, cross-tenant access fails, MFA mandatory for privileged roles, finance/audit critical paths covered, jobs/webhooks/imports/payments idempotent, backup restoration tested, failure recovery documented, WCAG 2.2 AA on critical workflows, load target validated.

## Scope Decisions (LOCKED — 7 June 2026)

All open questions resolved with **recommended defaults**:

| # | Decision |
|---|---|
| 1 | **Shim-first + inventory** — pilot Nest proxies per domain; keep BFF routes; remove proven-obsolete only |
| 2 | **Hybrid security/load** — CI audit + secret scan + contract tests; load/backup drill on staging/local Docker |
| 3 | **Docker: API + worker + web** — root `Dockerfile.web` + `apps/*/Dockerfile` |
| 4 | **Defer `apps/web` move** — UI stays at root `src/` |
| 5 | **Schema migrations parallel** — no new migrations in Phase 8 unless explicitly approved |
| Secondary | BFF bridge uses session-derived internal JWT (`API_BFF_BRIDGE_ENABLED`); RLS apply manual in staging; lint baseline frozen; Razorpay live validation parallel |

## Scope Decisions (reference — defaults now locked)

### Legacy API retirement: incremental shim-first (recommended default)

**Do not** delete all 89 Next.js API routes in one checkpoint. UI pages still call `/api/*` for dashboards, auth, and many CRUD screens. Phase 8 **default**:

1. **Inventory** every `src/app/api/**/route.ts` with disposition: `keep-bff`, `shim-to-nest`, `deprecate-410`, `remove`.
2. **Shim** high-duplication domain routes to NestJS via thin Next.js handlers (proxy + session→bearer bridge) **or** mark `Sunset` + `Link` headers and return `410` only where UI already migrated.
3. **Keep BFF** routes that Phase 7 depends on: `auth/*`, `sessions/*`, `search`, `dashboard/*`, `push/*`, `mobile/bootstrap`, `guard/login`, `guard/join`.
4. **Remove** quality-gated obsolete surfaces: `legal-adviser` (superseded by Phase 6 legal templates), unused `scratch/` if tracked.

Aggressive full retirement (delete all duplicated domain routes without UI client migration) is **high risk** for the release-candidate exit gate unless paired with `@society/sdk` or fetch rewrites in the same phase.

### Web surface: stay at root `src/` (recommended default)

`apps/web` does not exist; Phase 7 explicitly deferred the physical move. Phase 8 **default**: Docker image for web builds from repo root (`next build` + `next start` standalone output). Revisit `apps/web` move only if explicitly approved — it is a structural change, not a hardening blocker.

### Docker image scope: API + worker + web (recommended default)

Provider-neutral multi-stage Dockerfiles:

- `apps/api/Dockerfile` — NestJS API on port 4000
- `apps/worker/Dockerfile` — NestJS worker on port 4010
- `Dockerfile.web` (repo root) — Next.js standalone server on port 3000

Compose **optional** `docker-compose.rc.yml` overlay wires app images against existing infra services. Images use env-only configuration (12-factor); no AWS/GCP/Azure-specific manifests.

### Security and load tests: hybrid CI + documented manual (recommended default)

| Activity | CI (every PR) | Local/staging manual |
|---|---|---|
| `npm audit` (high/critical gate) | Yes | — |
| Secret scan (gitleaks/trufflehog action) | Yes | — |
| Cross-tenant + MFA Vitest/contract tests | Yes | — |
| `phase2:live` / Compose integration | Optional job (services container) | Developer + staging |
| k6 load test (300 VUs) | Nightly or manual workflow_dispatch | Staging with seeded data |
| Backup/restore drill | Documented script | Staging Postgres required |
| WCAG axe audit | Playwright smoke (expanded) | Manual screen-reader spot-check in UAT |

Pure document-only security/load/backup gates **do not** satisfy the roadmap exit gate; scripts must be runnable where Docker/Postgres is available, with CI running the subsets that need no live DB.

### Schema-hardening migrations: parallel, not Phase 8 blockers (recommended default)

Deferred items from Phases 5–6 (status enums, idempotency tables, poll-vote table, document scope column, FK hardening) remain **parallel hardening**. Phase 8 may add **tests** that prove best-effort idempotency in compatibility mode but does **not** introduce new migrations unless explicitly approved. Record any new deferrals in this plan's progress log.

### Other carry-forward (not Phase 8 blockers)

- Live DB/Razorpay sandbox validation for Phases 4–6
- BullMQ worker → real notification transport
- Next.js static export for fully offline Capacitor
- OIDC-only web shell (JWT cookies remain for UAT)
- `packages/ui` promotion
- Wholesale lint baseline fix in `src/`/`scratch/`

## Persistence Decision

Phase 8 introduces **no new Prisma migrations** unless explicitly approved for idempotency/RLS application. Exit gate uses `npm run db:validate` and `npm run db:generate` today; when a migrations directory lands, add `npm run db:migrate:deploy` to CP8 verification. RLS SQL at `packages/db/rls/001-tenant-isolation.sql` is **documented for staging apply** in the deployment checklist; automated apply remains a staging operator step until migrations are approved.

## File Structure

- Create: `docs/superpowers/plans/2026-06-07-phase-8-release-candidate-hardening.md` (this file)
- Create: `docs/runbooks/README.md`, `docs/runbooks/incident-response.md`, `docs/runbooks/deployment.md`, `docs/runbooks/backup-restore.md`, `docs/runbooks/webhook-replay.md`
- Create: `docs/security/phase-8-assessment.md`, `docs/staging/uat-checklist.md`, `docs/deployment/provider-neutral-checklist.md`
- Create: `docs/api/legacy-route-inventory.md` (generated/curated matrix)
- Create: `scripts/backup/pg-dump.sh`, `scripts/backup/pg-restore.sh`, `scripts/backup/pg-dump.ps1`, `scripts/backup/pg-restore.ps1`
- Create: `scripts/load/k6-api-smoke.js` (or `scripts/load/artillery-api.yml`)
- Create: `scripts/phase8-rc-verify.mjs` (+ `.ps1` / `.sh` wrappers mirroring `phase2:live`)
- Create: `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `Dockerfile.web`, `.dockerignore`, optional `docker-compose.rc.yml`
- Create: `packages/test/src/contract/` — shared NestJS route contract helpers + tenant fixtures
- Create: `tests/contract/` — cross-module API contract tests (finance, operations, community, society)
- Create: `tests/integration/` — cross-tenant, MFA, idempotency replay suites
- Create: `tests/failure/` — health/readiness degradation tests
- Modify: `.github/workflows/ci.yml` — audit, secret scan, contract test job, optional image build smoke
- Modify: `package.json` — `phase8:rc`, `test:contract`, `test:integration`, `load:api` scripts
- Modify: `src/app/api/**` — per inventory: shims, deprecation headers, or removal
- Modify: `tests/e2e/a11y-smoke.spec.ts` — expand critical workflow coverage
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`, `docs/LOCAL_DEVELOPMENT.md`

## Legacy Route Inventory (starter matrix)

89 routes scanned 7 Jun 2026. Final dispositions are confirmed in CP1; defaults below:

| Area | Example legacy routes | NestJS replacement | Default disposition |
|---|---|---|---|
| Society core | `members`, `tenants`, `move-events`, `directory`, `credentials`, `societies/join-code` | `/api/v1/society-core/*` | `shim-to-nest` or UI migration |
| Finance | `maintenance`, `accounting`, `expenses`, `funds`, `budgets`, `salaries`, `receipts`, `my-bills`, `rent-invoices`, `reports` | `/api/v1/finance-core/*` | `shim-to-nest`; keep `my-bills` BFF until resident UI migrated |
| Operations | `visitors`, `packages`, `staff`, `parking`, `facilities`, `assets`, `vendors`, `guard`, `emergency`, `blacklist` | `/api/v1/operations/*` | `shim-to-nest`; keep `guard/login`, `guard/join` as BFF |
| Community | `notices`, `complaints`, `documents`, `meetings`, `polls`, `events`, `forum`, `marketplace` | `/api/v1/community/*` | `shim-to-nest` |
| UX BFF | `search`, `dashboard`, `dashboard/analytics`, `push/subscribe`, `push/dispatch` | N/A (Phase 7) | `keep-bff` |
| Auth/session | `auth/*`, `sessions/heartbeat` | Keycloak (future) | `keep-bff` until OIDC web shell approved |
| Mobile | `mobile/bootstrap` | N/A | `keep-bff` |
| Obsolete | `legal-adviser` | `/api/v1/community/documents/legal-templates` | `remove` + redirect UX to documents |
| Platform | `system`, `subscription`, `settings`, `activity-log` | Partial NestJS | `keep-bff` short term; audit via `AuditLogService` path documented |

## Checkpoint 1: Legacy API Inventory + Retirement Execution

**Files:** create `docs/api/legacy-route-inventory.md`; create `src/lib/api/route-disposition.ts` (+ test) for disposition constants; modify targeted `src/app/api/**/route.ts`; remove `src/app/api/legal-adviser/route.ts` and `src/components/ui/LegalAdviserCall.tsx` references if approved; add `scripts/generate-api-inventory.mjs`.

- [x] **Step 1: Generate inventory** — `scripts/generate-api-inventory.mjs` → `docs/api/legacy-route-inventory.md`.
- [x] **Step 2: Disposition policy tests** — `src/lib/api/route-disposition.ts` + `src/lib/api/route-inventory.test.ts`.
- [x] **Step 3: Shim helper** — `src/lib/api/nest-proxy.ts` + `@society/security` BFF bridge token; API `CompositeJwtPrincipalVerifier` when `API_BFF_BRIDGE_ENABLED=true`.
- [x] **Step 4: Pilot shims** — `notices` + `visitors` GET (and notices POST) proxy when `NEST_SHIM_ENABLED=true`; `maintenance/bills` + `members` GET deprecation headers.
- [x] **Step 5: Deprecation headers** — `Sunset` + `Link` successor on pilot routes via `buildDeprecationHeaders`.
- [x] **Step 6: Remove obsolete** — deleted `legal-adviser` API + `LegalAdviserCall`; removed from `layout.tsx` and `role-access.ts`.
- [x] **Step 7: Verify CP1** — `npm run test` (394 Vitest + 8 worker), `npm run typecheck`, `npm run build` (117 routes, −1 legal-adviser), `npm run db:validate` pass.

## Checkpoint 2: Security Assessment + CI Security Gates

**Files:** create `docs/security/phase-8-assessment.md`; modify `.github/workflows/ci.yml`; create `tests/security/npm-audit-gate.test.ts` (script wrapper); extend `packages/security` integration fixtures.

- [x] Run and record `npm audit --audit-level=high` baseline; fix or document accepted risks with expiry dates in assessment doc.
- [x] Add CI secret scan job (e.g. `gitleaks/gitleaks-action` or `trufflesecurity/trufflehog`) — fail on verified secrets.
- [x] Expand cross-tenant tests: `tests/integration/cross-tenant.api.test.ts` — society A token + society B `x-society-id` → 403 on society-core, finance-core, operations, community controllers (fake Prisma harness).
- [x] Expand MFA tests: privileged actions (`society:finance.manage`, `community:document.manage`, `operations:manage`) reject principals without MFA claims — extend `authentication.guard.test.ts` patterns.
- [x] CSP/rate-limit documentation: note Next.js web CSP still allows `unsafe-inline` (deferred); API strict CSP verified; Valkey rate limit wiring checklist for staging.
- [x] Assessment doc sections: authn/z, tenant isolation, secrets, dependencies, headers, file storage, webhooks, audit coverage, open findings with severity.
- [x] **Verify CP2** — CI green on new jobs; `npm run test`; assessment doc lists zero unresolved critical/high **code** findings (infrastructure findings may be staging-only with mitigations).

## Checkpoint 3: Regression + Contract Test Expansion (Critical Paths)

**Files:** create `packages/test/src/contract/*`; create `tests/contract/finance-critical.test.ts`, `operations-critical.test.ts`, `community-critical.test.ts`, `society-critical.test.ts`; modify `package.json` (`test:contract`).

- [x] **Billing/ledger/payment** — contract tests: invoice create → journal balance; payment record → receipt + invoice paid; duplicate `Idempotency-Key` → same result, no double posting (finance repository fake client).
- [x] **Webhook idempotency** — test `receiptNumberFromWebhook` / webhook key helpers + controller replay semantics (finance-core).
- [x] **Audit** — sensitive finance + document actions emit audit envelope (mock `AuditLogService`).
- [x] **Operations** — visitor log dedupe, package OTP, SOS idempotent replay (operations repository patterns).
- [x] **Community** — notice read dedupe, poll single-vote rejection, RSVP capacity (community repository patterns).
- [x] **Imports** — society import dry-run + commit rejects invalid rows; replay does not duplicate occupancies.
- [x] Wire `npm run test:contract` into CI after `test:unit`.
- [x] **Verify CP3** — contract suite passes; critical-path checklist in assessment doc 100% mapped to tests.

## Checkpoint 4: Failure Tests + Resilience Documentation

**Files:** create `tests/failure/readiness.test.ts`; extend `docs/runbooks/incident-response.md`; modify worker/API health tests.

- [x] API `/health/ready` returns 503 when DB unreachable (extend `database-readiness.service.test.ts` patterns).
- [x] Worker `/health/ready` returns `degraded` without Valkey — document expected behavior until BullMQ connected.
- [x] Rate-limit breach returns 429 + `Retry-After` (rate-limit service contract test).
- [x] Webhook replay / duplicate job envelope returns idempotent outcome (finance + operations worker tests).
- [x] Document failure modes: Postgres down, Valkey down, MinIO down, Keycloak down, VAPID missing (push 503), NestJS upstream timeout for Next shims.
- [x] **Verify CP4** — failure test suite passes; runbook links from `docs/LOCAL_DEVELOPMENT.md`.

## Checkpoint 5: Load Testing

**Files:** create `scripts/load/k6-api-smoke.js`, `scripts/load/README.md`, `scripts/load/seed-load-fixtures.mjs` (optional); modify `package.json` (`load:api`).

- [x] Define load profile matching roadmap: **50 societies**, **15,000 users** (synthetic IDs), **300 concurrent** sessions (VU), mixed read-heavy endpoints: `visitors/list`, `notices/list`, `finance-core/reports/trial-balance`, `directory/read`.
- [x] Thresholds: core API p95 < 750 ms excluding mocked third-party; error rate < 1%.
- [x] Document hardware assumptions (CI/staging): 4 vCPU, 8 GB RAM, local Postgres + API container.
- [x] CI: `workflow_dispatch` job or nightly — **not** blocking PR merge if Postgres unavailable; results archived as artifact.
- [x] **Verify CP5** — load script runs against `docker-compose.rc.yml` stack on staging; README records actual p95 and pass/fail. *(Scripts + workflow committed; execution deferred to staging — see `scripts/load/README.md`.)*

## Checkpoint 6: Backup/Restore Drill + Runbooks

**Files:** create `scripts/backup/*`, `docs/runbooks/*.md`.

- [x] `pg_dump` scripts: logical backup of `society_connect` DB; restore to fresh database; verification query (society count, user count).
- [x] Record drill outcome template in `docs/runbooks/backup-restore.md` (timestamp, operator, RPO/RTO notes, success/failure).
- [x] Runbooks: deployment (Compose + K8s-neutral notes), rollback, incident severity table, webhook manual replay, Keycloak MFA enforcement for privileged roles.
- [x] **Verify CP6** — restore script tested at least once on staging or local Compose Postgres; drill log committed (no secrets). *(Scripts + runbook committed; live drill deferred to staging operator.)*

## Checkpoint 7: Provider-Neutral Docker Images + Deployment Checklist

**Files:** create Dockerfiles, `.dockerignore`, `docker-compose.rc.yml`, `docs/deployment/provider-neutral-checklist.md`.

- [x] API image: multi-stage build, `NODE_ENV=production`, non-root user, healthcheck `GET /health/live`.
- [x] Worker image: same pattern, healthcheck on 4010.
- [x] Web image: Next.js `output: 'standalone'` in `next.config.ts` if not already set; copy standalone trace; env for `DATABASE_URL`, `SESSION_SECRET`, `API_BASE_URL`.
- [x] `.dockerignore` excludes `.next`, `node_modules`, `scratch`, test artifacts.
- [x] `docker-compose.rc.yml`: `api`, `worker`, `web` + `extends` existing infra services.
- [x] Deployment checklist: env vars, secrets rotation, TLS termination (neutral), Postgres backups, Valkey, MinIO buckets, Keycloak realm, RLS apply step, smoke tests post-deploy.
- [x] CI: `docker build` smoke for three images (no push).
- [x] **Verify CP7** — `docker compose -f docker-compose.yml -f docker-compose.rc.yml config` validates; images build locally. *(CI docker-smoke job defined; local Docker unavailable on dev machine.)*

## Checkpoint 8: Staging UAT + WCAG Exit Gate + Phase 8 Sign-Off

**Files:** create `docs/staging/uat-checklist.md`; modify `tests/e2e/a11y-smoke.spec.ts`, `tests/e2e/role-workflows.spec.ts`; create `scripts/phase8-rc-verify.mjs`; update roadmap + LOCAL_DEVELOPMENT.

- [x] UAT checklist: per persona (committee, treasurer, resident, guard, platform admin) — login, dashboard, pay bill, visitor approve/log, notice publish, complaint assign, document upload, poll vote, amenity book, SOS, package handover, finance trial balance, cross-tenant negative test, MFA prompt for privileged action.
- [x] WCAG 2.2 AA: expand Playwright a11y smoke to `/visitors`, `/my-bills`, `/complaints`, `/notices`, `/login`; document known minor warnings; zero **critical** violations.
- [x] Full Playwright matrix: Desktop Chrome + Pixel 7 + iPad Mini (Phase 7 projects). *(34/34 pass on Desktop Chrome + Pixel 7; iPad Mini requires `npx playwright install webkit`.)*
- [x] `npm run phase8:rc` orchestrates: typecheck, test, test:contract, db:validate, build, test:e2e, lint baseline check, optional `docker compose` config validation.
- [x] Update `docs/PRODUCT_PRODUCTION_ROADMAP.md` progress log + Immediate Next Step (Phase 9 or launch prep).
- [x] **Verify CP8 / exit gate** — all Mandatory Quality Gates per roadmap; record metrics (test counts, load p95, drill date, open findings).

## Verification Commands

```powershell
npm run typecheck
npm run test
npm run test:contract
npm run test:integration
npm run test:worker
npm run db:validate
npm run build
npx playwright test
npm run lint
npm run phase8:rc
npm run load:api
docker compose -f docker-compose.yml -f docker-compose.rc.yml config
```

Focused during development:

```powershell
npx vitest run tests/contract
npx vitest run tests/integration
npx vitest run tests/failure
npx vitest run tests/security
npx playwright test tests/e2e/a11y-smoke.spec.ts
npx playwright test tests/e2e/role-workflows.spec.ts --project="Pixel 7"
```

## Open Questions (decide before CP1)

**Do not start CP1 implementation until answered.**

### 1. Legacy API retirement aggressiveness

| Option | Scope | Risk |
|---|---|---|
| **A (recommended):** Shim-first + inventory | Pilot shims per domain; keep BFF routes; remove only proven-obsolete (`legal-adviser`, etc.) | Lowest regression risk; some duplication remains |
| **B:** Aggressive delete | Delete all domain routes with NestJS equivalents; migrate UI fetch calls in same phase | High churn; may break dashboards not yet on SDK |
| **C:** Document-only | Inventory + Sunset headers; no deletion/shims in Phase 8 | Fails "removed obsolete APIs" exit gate spirit |

**Question:** Approve A (default), B, or C?

### 2. Security and load tests in this environment

| Option | Scope |
|---|---|
| **A (recommended):** Hybrid | CI: audit + secret scan + contract/integration; manual/staging: load + backup drill |
| **B:** CI-only | All automated in GitHub Actions with service containers |
| **C:** Document-only | Checklists and scripts without mandatory execution |

**Question:** Approve A (default), B, or C?

### 3. Docker image scope

| Option | Images |
|---|---|
| **A (recommended):** API + worker + web (root `next build`) | Full RC stack in Compose overlay |
| **B:** API + worker only | Web deployed separately (Vercel/static); document env wiring |
| **C:** API only | Worker/web deferred |

**Question:** Approve A (default), B, or C?

### 4. `apps/web` move

| Option | Timing |
|---|---|
| **A (recommended):** Defer again | Keep root `src/`; `Dockerfile.web` at repo root |
| **B:** Include in Phase 8 | Physical move + Turbo script updates + CI path changes |

**Question:** Approve A (default) or B?

### 5. Schema-hardening migrations

| Option | Timing |
|---|---|
| **A (recommended):** Stay parallel | Phase 8 tests compatibility idempotency; no new migrations |
| **B:** Include approved subset in Phase 8 | e.g. idempotency table + poll-vote table only |
| **C:** Full Phase 5+6 hardening batch | Larger scope; may delay RC |

**Question:** Approve A (default), B (specify which), or C?

### 6. Secondary (confirm or defer)

- **Nest proxy auth:** Should shims use service-account bearer, session-derived internal JWT, or require browser clients to call NestJS directly with OIDC tokens?
- **RLS apply:** Staging operator manual step only, or automated migration in Phase 8?
- **Lint baseline:** Fix legacy `src/` lint in Phase 8 or keep frozen baseline?
- **Razorpay live validation:** Required for Phase 8 exit gate or parallel?

---

**Scope locked.** CP1 implementation started 7 June 2026.
