# Phase 1 Engineering Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the production-grade monorepo foundation for the society-management product while keeping the current Next.js app runnable.

**Architecture:** Phase 1 introduces workspace structure, shared package boundaries, local infrastructure definitions, backend/worker scaffolding, and verification scripts. Business modules stay in the current Next.js app until Phase 2+ migrations.

**Tech Stack:** Node.js 24 target, pnpm workspace, Turborepo, Next.js web app, NestJS API scaffold, NestJS worker scaffold, Prisma/PostgreSQL, Valkey, MinIO, Keycloak, OpenAPI, Docker Compose, TypeScript, ESLint.

---

## Phase 1 Safety Rules

- Do not migrate domain APIs from Next.js to NestJS in this phase.
- Do not redesign the Prisma schema in this phase.
- Do not change user-facing behavior intentionally.
- Do not remove the current npm flow until the pnpm workspace flow is verified.
- Keep each checkpoint independently verifiable.
- Preserve the existing lint baseline honestly until source issues are fixed in a dedicated task.

## Checkpoint 1: Workspace Compatibility Scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `apps/.gitkeep`
- Create: `packages/.gitkeep`
- Modify: `package.json`
- Modify: `docs/superpowers/plans/2026-06-05-phase-1-engineering-foundation.md`

- [x] Add `pnpm-workspace.yaml` with workspace globs for `apps/*` and `packages/*`.
- [x] Add `turbo.json` with tasks for `build`, `lint`, `typecheck`, `test`, `dev`, and `clean`.
- [x] Add root scripts that preserve current commands and introduce future workspace commands:
  - `dev:web` -> `next dev`
  - `build:web` -> `prisma generate && next build`
  - `lint:web` -> `eslint`
  - `typecheck` -> `tsc --noEmit`
  - `phase1:status` -> prints current foundation status
- [x] Add empty `apps/` and `packages/` directories with `.gitkeep`.
- [x] Run `npm run typecheck`. Result: passed.
- [x] Run `npm run lint` and record the existing baseline. Result: failed with existing 57-problem baseline: 28 errors and 29 warnings.
- [x] Run `npm run build` only after typecheck/lint output is understood. Result: passed; Next.js generated 117 routes.

**Expected result:** Existing app scripts still work from the root. Workspace files exist but do not yet move runtime code.

**Checkpoint 1 status:** Complete. Root compatibility scaffold is active and the current app still type-checks and builds.

## Checkpoint 2: Root Configuration And Environment Contracts

**Files:**
- Create: `.env.example`
- Create: `docs/LOCAL_DEVELOPMENT.md`
- Create: `packages/config/package.json`
- Create: `packages/config/src/env.ts`
- Create: `packages/config/tsconfig.json`
- Modify: `tsconfig.json`

- [x] Add `.env.example` with non-secret placeholders for database, Keycloak, Valkey, MinIO, web, API, worker, session, and Razorpay future keys.
- [x] Add a `packages/config` package with a strict environment schema.
- [x] Add TypeScript path alias for future shared packages only after root/current app remains type-checkable.
- [x] Document local prerequisites and current known lint baseline in `docs/LOCAL_DEVELOPMENT.md`.
- [x] Run `npm run typecheck`. Result: passed. Also verified `npm run typecheck:config` passes.

**Expected result:** The project has a documented config contract without changing runtime behavior.

**Checkpoint 2 status:** Complete. Environment template, local development docs, config package, and TypeScript path alias are in place. Full type-check and build pass. Lint remains at the existing 28-error/29-warning baseline.

## Checkpoint 3: Local Infrastructure Skeleton

**Files:**
- Create: `docker-compose.yml`
- Create: `infra/keycloak/README.md`
- Create: `infra/minio/README.md`
- Create: `infra/postgres/README.md`
- Create: `infra/valkey/README.md`
- Modify: `docs/LOCAL_DEVELOPMENT.md`

- [x] Add Compose services for PostgreSQL, Valkey, MinIO, and Keycloak.
- [x] Use project-local named volumes.
- [x] Do not point the current app to these services by default until environment is explicitly configured.
- [x] Document local startup and shutdown commands.
- [x] Run `docker compose config` if Docker is available. Result: Docker CLI is not installed or not available on PATH, so Compose validation could not run in this environment.

**Expected result:** Local infrastructure is defined and validated, but not required for existing app startup unless selected through env vars.

**Checkpoint 3 status:** Complete with environment caveat. Docker Compose files and infrastructure docs are in place, Keycloak uses a separate local `keycloak` database, `npm run typecheck:config` passes, `npm run typecheck` passes, and `npm run build` passes. `npm run lint` remains at the existing 28-error/29-warning baseline. Docker validation must be rerun after Docker Desktop or Docker CLI is installed.

## Checkpoint 4: API Scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.module.ts`
- Create: `apps/api/src/common/request-id.middleware.ts`
- Create: `apps/api/src/common/problem-json.filter.ts`
- Modify: `package.json`

- [x] Add NestJS + Fastify API scaffold.
- [x] Add `/health/live` and `/health/ready`.
- [x] Add request ID middleware and consistent problem-style errors.
- [x] Add OpenAPI document generation at `/docs` for local development.
- [x] Add root script `dev:api`.
- [x] Run API type-check and startup smoke test. Result: `npm run typecheck:api` passes; smoke test returned `/health/live` status `ok`, `/health/ready` status `ok`, and `/docs` HTTP 200.

**Expected result:** API service starts independently and exposes health checks. No product APIs exist yet.

**Checkpoint 4 status:** Complete. NestJS/Fastify API scaffold is in place with health endpoints, request IDs, problem-json responses, and OpenAPI docs. Full root type-check and Next.js build pass. Lint remains at the existing 28-error/29-warning baseline. `npm install` reported 19 dependency vulnerabilities, which must be handled in a dedicated dependency-audit checkpoint rather than hidden.

## Checkpoint 5: Worker Scaffold

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/main.ts`
- Create: `apps/worker/src/app.module.ts`
- Create: `apps/worker/src/health/worker-health.ts`
- Modify: `package.json`

- [x] Add NestJS worker bootstrap.
- [x] Add Valkey/BullMQ connection placeholders.
- [x] Add a diagnostic startup log and graceful shutdown hooks.
- [x] Add root script `dev:worker`.
- [x] Run worker type-check and startup smoke test. Result: `npm run test:worker` passes; `npm run typecheck:worker` passes; full `npm run typecheck` passes; smoke test returned `/health/live` status `ok` and `/health/ready` HTTP 503 with degraded placeholder queue state as expected for Phase 1.

**Expected result:** Worker starts independently without processing product jobs.

**Checkpoint 5 status:** Complete. NestJS worker scaffold is in place with a dedicated bootstrap, placeholder Valkey/BullMQ readiness reporting, diagnostic startup logs, and graceful shutdown handling. Root scripts now include `dev:worker`, `test:worker`, and `typecheck:worker`. Full root type-check passes. Readiness intentionally stays degraded until a real queue connection is implemented in a later checkpoint.

## Checkpoint 6: Database Package Boundary

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/README.md`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/connection-url.ts`
- Create: `packages/db/src/prisma.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/connection-url.test.ts`
- Create: `apps/api/src/database/database.module.ts`
- Create: `apps/api/src/database/database-readiness.service.ts`
- Create: `apps/api/src/database/database-readiness.service.test.ts`
- Modify: `prisma.config.ts`
- Modify: `package.json`
- Modify: `src/lib/prisma.ts`
- Modify: `apps/api/src/health/health.controller.ts`
- Modify: `apps/api/src/health/health.module.ts`

- [x] Introduce `packages/db` as the future owner of Prisma and migrations.
- [x] Keep existing `prisma/schema.prisma` in place unless moving it is proven safe in the same checkpoint.
- [x] Add scripts for Prisma validate, generate, migrate deploy, seed, and reset.
- [x] Run Prisma validate/generate. Result: `npm run db:validate` passes; `npm run db:generate` passes; `npm --prefix packages/db run validate` passes; `npm --prefix packages/db run generate` passes.
- [x] Add shared Prisma client and PostgreSQL pool creation under `packages/db/src`.
- [x] Re-export the shared Prisma client from `src/lib/prisma.ts` so existing Next.js domain code keeps its current import path.
- [x] Add safe database URL redaction for logs and health responses.
- [x] Add NestJS `DatabaseModule` and database readiness service.
- [x] Make API `/health/ready` database-aware while keeping `/health/live` process-only.
- [x] Add focused tests for URL redaction and database readiness snapshots. Result: `npm run test:unit -- --run packages/db/src/connection-url.test.ts apps/api/src/database/database-readiness.service.test.ts` passes.
- [x] Run DB/API type-checks. Result: `npm run typecheck:db` passes; `npm run typecheck:api` passes.

**Expected result:** Database ownership is documented and scriptable without schema redesign.

**Checkpoint 6 status:** Complete and strengthened. `@society/db` now records future Prisma and PostgreSQL ownership while the active schema, migrations, seed script, and Prisma config remain in their existing root locations. Root scripts expose validate, generate, migrate deploy, seed, and reset commands, and package-level `@society/db` scripts delegate to those root commands. Runtime Prisma singleton logic now lives in `packages/db`, the current Next.js app reuses it through `src/lib/prisma.ts`, and the NestJS API has database-aware readiness checks.

## Checkpoint 7: Testing And CI Foundation

**Files:**
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.github/workflows/ci.yml`
- Create: `packages/test/package.json`
- Create: `packages/test/src/index.ts`
- Modify: `package.json`

- [x] Add unit test runner foundation.
- [x] Add Playwright web smoke-test foundation.
- [x] Add shared test package for future factories.
- [x] Add CI workflow for install, lint, type-check, tests, Prisma validate, and build.
- [x] Mark current lint failures as baseline in docs, not as ignored rules unless explicitly approved. Result: `npm run lint` still reports the existing 57-problem baseline: 28 errors and 29 warnings.

**Expected result:** CI exists and shows current quality baseline clearly.

**Checkpoint 7 status:** Complete. Vitest is configured for unit tests, Playwright is configured for web smoke tests, `@society/test` provides initial deterministic test helpers, and GitHub Actions CI now installs dependencies, reports the current lint baseline, runs type-checks and tests, installs Playwright Chromium, validates Prisma, and builds the app. Verification passed for `npm run test:unit`, `npm run test:worker`, `npm run test`, `npm run test:e2e -- --list`, `npm run test:e2e`, `npm run typecheck:test`, `npm run typecheck`, `npm run db:validate`, and `npm run build`.

## Checkpoint 8: Verification And Phase 2 Handoff

**Files:**
- Modify: `.gitignore`
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`
- Modify: `docs/superpowers/plans/2026-06-05-phase-1-engineering-foundation.md`

- [x] Record which scripts pass and fail.
- [x] Record remaining source-code baseline issues.
- [x] Record what Phase 2 can now depend on.
- [x] Confirm no business behavior was intentionally changed.
- [x] Make Phase 1 handoff files commit-visible by unignoring `.env.example` and `.github/workflows/ci.yml`.

**Expected result:** Phase 1 foundation is ready enough to begin identity, tenancy, and security work.

**Verification result:** `npm run phase1:status`, `npm run typecheck:config`, `npm run typecheck:db`, `npm run typecheck:api`, `npm run typecheck:worker`, `npm run typecheck:test`, `npm run typecheck`, `npm run test`, `npm run db:validate`, `npm run db:generate`, `npm run test:e2e -- --list`, `npm run test:e2e`, and `npm run build` pass. `npm run build` generated 117 routes. `npm run lint` fails at the known baseline of 57 problems: 28 errors and 29 warnings. `docker compose config` could not run because Docker CLI is not installed or not on PATH.

**Phase 2 can depend on:** workspace scaffolding, environment contracts, local infrastructure definitions, NestJS API and worker scaffolds, shared Prisma database boundary, DB-aware API readiness, Vitest/Playwright test foundations, and CI workflow definition.

**Behavior note:** No product/domain API migration was intentionally performed in Phase 1. Current business modules remain in the existing Next.js app.

**Checkpoint 8 status:** Complete with caveats. Phase 1 foundation is ready for Phase 2 planning and implementation, but lint cleanup, dependency audit, and Docker validation remain explicit follow-up tasks.
