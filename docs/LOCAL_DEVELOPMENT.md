# Local Development

Last updated: 7 June 2026

This project is being migrated from a single Next.js app into a production-grade TypeScript modular monolith. The current app still runs from the repository root during Phase 1.

## Current Safe Commands

```powershell
npm run dev
npm run dev:api
npm run dev:worker
npm run dev:web
npm run test:worker
npm run typecheck
npm run typecheck:api
npm run typecheck:community-core
npm run typecheck:config
npm run typecheck:db
npm run typecheck:finance-core
npm run typecheck:operations-core
npm run typecheck:security
npm run typecheck:society-core
npm run typecheck:worker
npm run typecheck:ux-core
npm run db:validate
npm run db:generate
npm run test
npm run test:e2e
npm run cap:sync
npm run cap:open:android
npm run build
npm run phase1:status
npm run phase2:live
npm run phase8:rc
npm run test:contract
npm run test:integration
npm run test:failure
npm run test:security
npm run load:api
docker compose config
docker compose -f docker-compose.yml -f docker-compose.rc.yml config
docker compose up -d postgres valkey minio keycloak
docker compose down
```

`npm run lint` is intentionally not listed as passing yet. It currently reports the existing baseline of 28 errors and 29 warnings.

## Environment Setup

Copy `.env.example` to `.env` and replace placeholder secrets before running services that require them.

Minimum current app variables:

- `DATABASE_URL`: pooled Neon connection string used by the web app, API, and worker
- `DIRECT_URL`: direct Neon connection string used by Prisma schema commands
- `SESSION_SECRET`

Verify the configured database before starting the app:

```powershell
npm run db:check
```

The check refuses non-Neon hosts and runs a real query against the configured database. Prisma runtime access also fails immediately when `DATABASE_URL` is missing instead of falling back to a local or dummy database.

Future Phase 1/2 variables are already documented in `.env.example` for:

- Phase 2 security switches and OIDC validation endpoints
- NestJS API
- Worker
- Keycloak
- Valkey
- MinIO/S3-compatible storage
- Web push
- Email/SMS providers
- Razorpay
- OpenTelemetry

Do not commit real `.env` files or production secrets.

## Local Infrastructure

Phase 1 defines local infrastructure in `docker-compose.yml`.

Services:

- PostgreSQL: `localhost:5432`
- Valkey: `localhost:6379`
- MinIO API: `localhost:9000`
- MinIO console: `localhost:9001`
- Keycloak: `localhost:8080`

Start all local infrastructure:

```powershell
docker compose up -d postgres valkey minio keycloak
```

Start only the current database:

```powershell
docker compose up -d postgres
```

Validate Compose without starting containers:

```powershell
docker compose config
```

Stop services while keeping data volumes:

```powershell
docker compose down
```

Stop services and delete local data volumes:

```powershell
docker compose down -v
```

These services are opt-in. The current app uses whichever database is configured in `.env`; adding Compose does not automatically switch runtime behavior.

PostgreSQL 18 stores versioned data directories below `/var/lib/postgresql`, so the Compose volume is mounted there instead of `/var/lib/postgresql/data`.

Service details:

- `infra/postgres/README.md`
- `infra/valkey/README.md`
- `infra/minio/README.md`
- `infra/keycloak/README.md`

## Phase 1 Status

Completed:

- Root compatibility workspace scaffolding.
- `pnpm-workspace.yaml`.
- `turbo.json`.
- Placeholder `apps/` and `packages/`.
- Root scripts for web compatibility and status checks.
- Shared `@society/config` package foundation.
- `.env.example`.
- Docker Compose services for PostgreSQL, Valkey, MinIO, and Keycloak.
- NestJS API scaffold with health endpoints and OpenAPI docs.
- NestJS worker scaffold with placeholder Valkey/BullMQ readiness reporting.
- `@society/db` package boundary for Prisma client reuse, database URL redaction, and future database ownership.
- Vitest unit-test foundation, Playwright smoke-test foundation, shared `@society/test` helpers, and CI workflow.
- Git tracking rules for `.env.example` and `.github/workflows/ci.yml`.
- Phase 1 verification and Phase 2 handoff notes.

Not done yet:

- Moving the current app into `apps/web`.
- Domain API migration.
- Fixing the existing lint baseline.
- Running Docker Compose validation locally; Docker CLI is not installed or not on PATH in this environment.

## Known Quality Baseline

As of 5 June 2026:

- `npm run typecheck`: passes.
- `npm run build`: passes.
- `npm run lint`: fails with 57 total problems: 28 errors and 29 warnings.

As of 6 June 2026, final Phase 1 handoff verification:

- `npm run phase1:status`: passes.
- `npm run typecheck:config`: passes.
- `npm run typecheck:db`: passes.
- `npm run typecheck:security`: passes.
- `npm run typecheck:api`: passes.
- `npm run typecheck:worker`: passes.
- `npm run typecheck:test`: passes.
- `npm run typecheck`: passes.
- `npm run test`: passes.
- `npm run db:validate`: passes.
- `npm run db:generate`: passes.
- `npm run test:e2e -- --list`: passes and finds 1 smoke test.
- `npm run test:e2e`: passes.
- `npm run build`: passes and generates 117 routes.
- `npm run lint`: fails with the known 57-problem baseline: 28 errors and 29 warnings.
- `docker compose config`: not verified because Docker CLI is unavailable.

Representative lint categories:

- `@typescript-eslint/no-explicit-any`
- React 19 `react-hooks/set-state-in-effect`
- `react/no-unescaped-entities`
- unused imports/variables
- `@next/next/no-img-element`

These should be fixed as explicit quality tasks, not hidden by loosening lint rules.

CI currently runs the lint step with `continue-on-error` so type-checks, tests, Prisma validation, Playwright smoke testing, and build can still report while the known lint baseline remains visible.

## API Scaffold

Start the local API:

```powershell
npm run dev:api
```

Useful local endpoints:

- `http://localhost:4000/health/live`
- `http://localhost:4000/health/ready`
- `http://localhost:4000/docs`

The API currently exposes health and documentation only. Product/domain APIs remain in the current Next.js app until later migration phases.

Phase 2 security scaffolding now lives in `apps/api/src/security` and `packages/security`.
Migrated API routes should use:

- `AuthenticationGuard` to validate bearer tokens, require `x-society-id`, and attach `principal` plus `tenant` context.
- `SecurityPolicyService` to enforce central permissions.
- `RateLimitService` for the API rate-limit boundary before a real Valkey adapter is connected.
- `FileStoragePolicyService` for tenant-scoped private upload/download intent generation.
- `NotificationFoundationService` for idempotent notification job envelopes.
- `AuditLogService` for persistent `SecurityEvent` and `ActivityLog` writes.
- `ValkeyRateLimitStore` for distributed rate-limit buckets once Valkey is running.
- `S3PresignedUrlService` for SigV4 presigned object-storage URLs.

Phase 3 society-core scaffolding now lives in `packages/society-core` and `apps/api/src/society-core`.
The NestJS API exposes tenant-protected planning surfaces under `/api/v1/society-core`:

- `POST /api/v1/society-core/setup-plan`
- `POST /api/v1/society-core/setup`
- `POST /api/v1/society-core/imports/dry-run`
- `POST /api/v1/society-core/imports/commit`
- `POST /api/v1/society-core/occupancy/move-plan`
- `POST /api/v1/society-core/occupancy/commit`
- `POST /api/v1/society-core/credentials/issue`
- `POST /api/v1/society-core/directory`
- `POST /api/v1/society-core/directory/read`

These routes provide the tested Phase 3 domain, authorization boundary, and database-backed persistence boundary for societies, units, people, occupancies, committed imports, credential account issuance, and resident directory reads.

Current Phase 3 persistence uses the existing Prisma schema:

- `Society` stores the society profile and total configured unit count.
- `Unit.wing` and `Unit.floor` represent building inventory slices during this compatibility phase.
- `Person` and `UnitOccupancy` represent owners, tenants, residents, active/vacant/moved-out states, and billing responsibility.
- `User` stores the local credential bridge while OIDC remains the identity source of truth.
- `MoveEvent` is recorded for units that still have a legacy `Flat` link.

There is still no Prisma migrations directory in this checkout. Add first-class building/wing/floor tables only as a dedicated schema-migration checkpoint after the current compatibility phase is committed.

Phase 4 finance-core scaffolding now lives in `packages/finance-core`.
Phase 4 compatibility checkpoints provide:

- Default chart-of-accounts definitions.
- Balanced journal posting plan validation.
- Required idempotency keys for financial postings.
- Posting-line helpers for maintenance invoices, payment collection, and paid expenses.
- Receipt number and Razorpay webhook idempotency-key helpers.
- Payroll posting helpers.
- NestJS finance API boundaries under `/api/v1/finance-core`.
- Database-backed compatibility repository methods for chart of accounts, journal vouchers, invoices, payments, receipts, expenses, budgets, funds, payroll, and trial balance.
- Deterministic finance worker job envelopes in `apps/worker/src/finance-worker.ts`.

Use this focused command while working on the package:

```powershell
npm run typecheck:finance-core
npx vitest run packages/finance-core/src/finance-core.test.ts
```

Remaining Phase 4 hardening is live validation, provider sandbox execution, dedicated idempotency persistence, and schema migrations.
Current finance API endpoints:

- `POST /api/v1/finance-core/chart-of-accounts/ensure`
- `POST /api/v1/finance-core/journal-vouchers/plan`
- `POST /api/v1/finance-core/journal-vouchers/post`
- `POST /api/v1/finance-core/reports/trial-balance`
- `POST /api/v1/finance-core/invoices/create`
- `POST /api/v1/finance-core/payments/record`
- `POST /api/v1/finance-core/expenses/record`

Before treating Phase 4 as production-ready, run live validation against the real local database and provider sandbox for Razorpay/webhooks. The current compatibility repository uses existing Prisma finance models; a dedicated idempotency table and Phase 4 migrations are still hardening work.

Phase 5 operations scaffolding now lives in `packages/operations-core` and `apps/api/src/operations`.
Phase 5 runs in compatibility mode (reuse existing Prisma operations models, no new migrations directory). Recommended schema hardening for a future migration checkpoint is recorded in `docs/superpowers/plans/2026-06-07-phase-5-operations-security.md`.

`@society/operations-core` provides pure operational invariants: the visitor lifecycle state machine, walk-in vs pre-approved logging, deterministic offline-replay dedupe keys, visitor passcode generation, and retry-safe guard action envelopes.

Phase 5 is complete and exposes tenant-protected operations endpoints under `/api/v1/operations` (all enforce central operations permissions and are idempotent on duplicate/offline replays where applicable):

- Visitors & patrol (CP1): `visitors/log`, `visitors/respond`, `visitors/transition`, `visitors/list`, `patrol/scan`, `patrol/list`.
- Packages (CP2): `packages/intake`, `packages/notify`, `packages/collect` (OTP), `packages/transition`, `packages/list`.
- Domestic staff & attendance (CP3): `staff/register`, `staff/link-flat`, `staff/attendance/check-in`, `staff/attendance/check-out`, `staff/list`, `staff/attendance/list`.
- Parking (CP4): `parking/zones/create`, `parking/slots/create`, `parking/slots/assign`, `parking/slots/release`, `parking/slots/list`, `parking/capacity`.
- Facilities/amenities/bookings (CP5): `amenities/create`, `amenities/policy`, `amenities/schedule`, `amenities/bookings/create`, `amenities/bookings/cancel`, `amenities/waitlist/join`, `amenities/bookings/list`.
- Vendors & assets (CP6): `vendors/create`, `vendors/list`, `assets/create`, `assets/record-maintenance`, `assets/due`.
- Incidents/blacklist/SOS (CP7): `incidents/report`, `incidents/list`, `sos/raise`, `blacklist/add`, `blacklist/check`.

Permission model: `operations:gate.manage` (guard gate actions, no MFA for mobile-first PIN workflows), `operations:visitor.respond` and `operations:booking.manage` (residents), `operations:sos.raise` (residents/guards), `operations:read` (reads), and `operations:manage` (MFA-required management of staff/parking/amenities/vendors/assets/blacklist).

`@society/operations-core` provides all pure operational invariants (state machines, policy validation, dedupe keys, escalation tiers, coverage/maintenance scheduling). Background reminders/escalations use deterministic, retry-safe envelopes built by `apps/worker/src/operations-worker.ts` (`buildOperationsWorkerJob`).

Use these focused commands while working on operations:

```powershell
npm run typecheck:operations-core
npx vitest run packages/operations-core packages/operations-core/src/operations-core.test.ts
npx vitest run apps/api/src/operations
node --import tsx --test apps/worker/src/operations-worker.test.ts
```

Phase 6 community/governance scaffolding now lives in `packages/community-core` and `apps/api/src/community`.
Phase 6 runs in compatibility mode (reuse existing Prisma community/governance models, no new migrations directory). Recommended schema hardening for a future migration checkpoint is recorded in `docs/superpowers/plans/2026-06-07-phase-6-community-governance.md`.

`@society/community-core` provides pure community/governance invariants: notice retention/read-dedupe, complaint lifecycle/SLA/escalation, document scope encoding/visibility/versioning, poll voting controls and tally, event lifecycle + RSVP capacity, forum/marketplace moderation and listing privacy, non-advisory legal checklist templates, and a generic community event envelope.

Phase 6 is complete and exposes tenant-protected community endpoints under `/api/v1/community` (all enforce central community permissions; idempotent on duplicate/replay where applicable):

- Notices (CP1): `notices/create`, `notices/list`, `notices/mark-read`, `notices/read-receipts`.
- Helpdesk (CP2): `helpdesk/raise`, `helpdesk/assign`, `helpdesk/transition`, `helpdesk/escalate`, `helpdesk/rate`, `helpdesk/list`.
- Documents (CP3): `documents/upload-intent`, `documents/create`, `documents/list`, `documents/legal-templates`, `documents/legal-templates/instantiate`.
- Governance (CP4): `meetings/record`, `meetings/list`, `polls/create`, `polls/vote`, `polls/close`, `polls/results`, `polls/list`.
- Events (CP5): `events/create`, `events/transition`, `events/rsvp`, `events/list`, `events/rsvps`.
- Forum & marketplace (CP6): `forum/threads/create`, `forum/threads/reply`, `forum/threads/moderate`, `forum/threads/list`, `forum/threads/replies`, `marketplace/listings/create`, `marketplace/listings/transition`, `marketplace/listings/interest`, `marketplace/listings/moderate`, `marketplace/listings/list`.

Permission model: `community:read` (reads), `community:notice.manage` / `community:helpdesk.manage` / `community:moderate` (committee/admin desk + moderation, no MFA), `community:helpdesk.respond` / `community:vote.cast` / `community:rsvp.manage` / `community:post` (residents), and `community:document.manage` / `community:governance.manage` (MFA-required document and governance management).

Background community reminders/nudges use deterministic, retry-safe envelopes built by `apps/worker/src/community-worker.ts` (`buildCommunityWorkerJob`).

Use these focused commands while working on community/governance:

```powershell
npm run typecheck:community-core
npx vitest run packages/community-core apps/api/src/community
node --import tsx --test apps/worker/src/community-worker.test.ts
```

Phase 7 cross-role UX is complete in compatibility mode on root `src/` (no `apps/web` move). See `docs/superpowers/plans/2026-06-07-phase-7-cross-role-ux-pwa-capacitor.md`.

`@society/ux-core` provides persona resolution, permission-filtered navigation models, quick-action catalogs, and search privacy shaping.

`src/lib/navigation/` bridges legacy session roles to `@society/security` and powers `Sidebar`, `BottomNav`, `Header`, and `CommandPalette`.

PWA/offline: `public/sw.js` (v3), `public/manifest.json`, `src/lib/mobile/offline-mutations.ts`.

Push compatibility mode: `src/lib/push/notification-routing.ts`, `POST /api/push/dispatch`.

Capacitor Android sync:

```powershell
npm run cap:sync
npm run cap:open:android
# Optional live-server packaged QA:
# $env:CAPACITOR_SERVER_URL="http://10.0.2.2:3000"; npm run cap:sync
```

Focused Phase 7 commands:

```powershell
npm run typecheck:ux-core
npx vitest run packages/ux-core src/lib/navigation src/lib/push
npx playwright test tests/e2e/role-workflows.spec.ts
npx playwright test tests/e2e/mobile-viewports.spec.ts --project="Pixel 7"
```

Phase 8 release-candidate hardening is complete in compatibility mode. See `docs/superpowers/plans/2026-06-07-phase-8-release-candidate-hardening.md`.

Legacy API inventory: `docs/api/legacy-route-inventory.md` (regenerate with `node scripts/generate-api-inventory.mjs`). Nest shims activate when `NEST_SHIM_ENABLED=true` and `API_BFF_BRIDGE_ENABLED=true` with `npm run dev:api` running.

Runbooks: `docs/runbooks/README.md` (incident, deployment, backup-restore, webhook-replay). Staging UAT: `docs/staging/uat-checklist.md`. Deployment checklist: `docs/deployment/provider-neutral-checklist.md`.

Focused Phase 8 commands:

```powershell
npm run phase8:rc
npx vitest run tests/contract tests/integration tests/failure tests/security
npx playwright test --project="Desktop Chrome" --project="Pixel 7"
npx playwright install webkit   # required for iPad Mini project
npm run load:api                  # requires k6 + staging API bearer token
scripts/backup/pg-dump.ps1        # or pg-dump.sh on Linux
docker compose -f docker-compose.yml -f docker-compose.rc.yml up -d
```

The current JWT verifier uses `KEYCLOAK_ISSUER_URL`, `KEYCLOAK_JWKS_URL`, and `KEYCLOAK_CLIENT_ID`. The local Keycloak realm import is `infra/keycloak/society-connect-realm.json`; Docker Compose mounts it into Keycloak and starts with `--import-realm`.

Tenant RLS SQL for core society-scoped tables is tracked at `packages/db/rls/001-tenant-isolation.sql`. Apply it only after the request/session path sets `app.current_society_id`.

Once Docker is running, use the one-command Phase 2 runtime check:

```powershell
npm run phase2:live
```

This command is OS-aware: on Windows it uses `scripts/phase2-live-validate.ps1`; on WSL/Linux it uses `scripts/phase2-live-validate.sh`.
It validates Docker daemon readiness, Compose config, starts PostgreSQL/Valkey/MinIO/Keycloak, shows service status, then runs Prisma validation/generation, type-check, tests, and build.

For WSL2, run it from Ubuntu after installing Docker Engine inside WSL:

```bash
cd /mnt/c/Users/pawan/Projects/society_connect/P1-society-connect
npm run phase2:live
```

If WSL resolves Windows Node/npm from `/mnt/c/Program Files/nodejs`, install Linux Node inside WSL first:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24
nvm alias default 24
which node
which npm
node -p "process.platform"
```

Expected: `which node` and `which npm` should point under your Linux home directory, and `node -p "process.platform"` should print `linux`.

If Docker Desktop was just installed and `npm run phase2:live` fails at `Docker daemon readiness` with a `dockerDesktopLinuxEngine` HTTP 500, finish Docker Desktop first-run setup from the desktop app and restart Windows if requested. Then open a fresh terminal and rerun:

```powershell
npm run phase2:live
```

## Worker Scaffold

Start the local worker:

```powershell
npm run dev:worker
```

Useful local endpoints:

- `http://localhost:4010/health/live`
- `http://localhost:4010/health/ready`

The worker currently boots a NestJS application context, exposes health endpoints for smoke testing, and reports a BullMQ/Valkey placeholder connection. `ready` intentionally returns HTTP `503` with `status: "degraded"` until a real queue connection is introduced in a later checkpoint.

## Database Boundary

The active Prisma files remain in the root `prisma/` directory during Phase 1:

- `prisma/schema.prisma`
- `prisma/migrations`
- `prisma/seed.ts`
- `prisma.config.ts`

`packages/db` now owns the shared Prisma client boundary used by the current Next.js app and the NestJS API scaffold. The active schema still stays in the root `prisma/` directory, but runtime Prisma creation, connection-pool defaults, and safe database-target redaction live in `packages/db/src`.

The current Next.js app continues to import `prisma` from `src/lib/prisma.ts`; that file now re-exports the shared `@society/db` client to avoid maintaining duplicate Prisma singleton logic.

The NestJS API imports the same shared DB package through `apps/api/src/database/database.module.ts`. `/health/live` only confirms the API process is running. `/health/ready` now performs a database ping and returns `503` when the database is unavailable.

Common validation commands:

```powershell
npm run db:validate
npm run db:generate
npm run typecheck:db
npm --prefix packages/db run validate
npm --prefix packages/db run generate
```

Database mutation commands are available but should only be run against the intended environment:

```powershell
npm run db:migrate:deploy
npm run db:seed
npm run db:reset
```

## Testing And CI

Unit tests use Vitest:

```powershell
npm run test:unit
```

Worker tests currently use Node's built-in test runner:

```powershell
npm run test:worker
```

Run both current automated test groups:

```powershell
npm run test
```

Playwright smoke tests use `playwright.config.ts` and start the web app through `npm run dev:web`:

```powershell
npx playwright install chromium
npm run test:e2e
```

GitHub Actions CI is defined at `.github/workflows/ci.yml`. It installs dependencies, reports the current lint baseline, runs type-checks and tests, validates Prisma, and builds the app.

## Phase Boundary

Phase 1 foundation work must not intentionally change user-facing behavior. Domain modules remain in the current Next.js app until later migration phases.
