# Phase 1 Engineering Foundation Outline

> This is an outline only. Before Phase 1 implementation starts, convert this into a detailed TDD execution plan with exact tasks, tests, commands, and rollback checkpoints.

## Goal

Create the new production-grade monorepo foundation while preserving current product behavior.

Phase 1 must not migrate domain modules yet. It should make room for the migration by establishing workspace structure, local infrastructure, API/worker scaffolds, CI, tests, configuration, observability, and generated API contracts.

## Proposed Structure

```text
apps/
  web/
  api/
  worker/
packages/
  config/
  db/
  sdk/
  test/
  ui/
```

## Inputs From Phase 0

- Current app has 88 API route files and 48 page files.
- Current Prisma schema has 78 models.
- Current source test/deployment scaffolding is missing.
- Current app uses npm; Phase 1 target is pnpm workspaces with Turborepo.
- Current business APIs remain in Next.js during Phase 1.
- Phase 1 must preserve a runnable web app before any domain migration begins.

## Required Foundation Work

Workspace:

- Introduce pnpm workspace and Turborepo.
- Move the current app into `apps/web` with minimal behavior change.
- Keep package scripts for dev, lint, build, type-check, test, and generated clients.

Backend scaffold:

- Add `apps/api` with NestJS and Fastify.
- Add `/health/live`, `/health/ready`, request IDs, structured logging, config validation, and OpenAPI document generation.
- Add a placeholder authenticated `/api/v1/me` contract only after identity foundation is defined in Phase 2.

Worker scaffold:

- Add `apps/worker` with NestJS application bootstrap.
- Add BullMQ connection plumbing against Valkey.
- Add a sample health/diagnostic job only; no product jobs yet.

Database:

- Move Prisma ownership into `packages/db`.
- Preserve the current schema until Phase 2/3 redesign work begins.
- Add migration discipline, seed boundaries, and test database conventions.

Local infrastructure:

- Add Docker Compose services for PostgreSQL, Valkey, MinIO, and Keycloak.
- Add `.env.example` templates with no secrets.
- Add local startup documentation.

Testing and CI:

- Add unit test runner.
- Add API integration test foundation.
- Add Playwright foundation for web smoke tests.
- Add CI checks for lint, type-check, build, tests, Prisma validation, and dependency/security scanning.

Observability:

- Add OpenTelemetry-ready logging and tracing structure.
- Add health checks and consistent error envelopes.
- Add service metadata: app name, version, environment, request ID.

## Non-Goals

- Do not migrate business modules from Next.js to NestJS in Phase 1.
- Do not redesign the Prisma schema in Phase 1 except for mechanical package relocation needs.
- Do not integrate Razorpay in Phase 1.
- Do not implement Keycloak login flows in Phase 1 beyond local service availability.
- Do not choose production cloud provider, public brand, or selling model.

## Phase 1 Exit Gate

- One command can start local web, API, worker, PostgreSQL, Valkey, MinIO, and Keycloak.
- Current web app still builds.
- API and worker health checks pass.
- CI can run lint, type-check, build, tests, and Prisma validation.
- No current product behavior is intentionally changed.
- Phase 2 can begin identity/tenancy work without restructuring the repo again.

