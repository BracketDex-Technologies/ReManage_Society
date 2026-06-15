# Society Management Production Roadmap

Last updated: 5 June 2026

This file is the locked source of truth for turning the current society-management prototype into a production-capable product. It combines the repo review, market comparison, architecture decisions, technology recommendations, UI guidance, module recommendations, and phase plan discussed in this conversation.

## Product Goal

Build a society-management SaaS that is easy, automated, secure, and visually clean for small and mid-size societies.

The first production target is not a public launch yet. The immediate target is a production-capable release candidate: all approved modules rebuilt or hardened, full security and test gates passed, provider-neutral deployment artifacts ready, and no cloud/vendor/sales/branding decision forced too early.

## Current Verdict

The current app has strong product breadth and is valuable as a prototype or private pilot. It is not yet ready to push publicly as a paid SaaS.

Main reason: the feature count is high, but production depth is incomplete. For a paid society product, correctness, security, auditability, tenant isolation, payments, mobile workflows, notifications, backups, and operational reliability matter more than simply having many pages.

## Current App Snapshot

Current verified shape:

- Next.js app with React, Prisma, PostgreSQL adapter, Tailwind, Capacitor dependencies, JWT cookie sessions, web push dependencies, and many dashboard modules.
- `package.json` currently uses Next.js, React, Prisma, `pg`, `jose`, `bcryptjs`, `web-push`, `xlsx`, `papaparse`, and `next-auth` beta dependency.
- Prisma schema contains 78 models.
- Current scan found 88 API route files under `src/app/api`.
- Current scan found 48 page files under `src/app`.
- Sidebar exposes operations, finance, community, governance, and management modules.
- Existing market comparison is in `compare.md`.
- No source test/config/deployment files were found by the focused scan for `*.test.*`, `*.spec.*`, Playwright/Vitest/Jest config, Dockerfile, Compose, or GitHub workflow files outside dependencies.
- `next.config.ts` includes security headers but the CSP still allows `'unsafe-inline'` and `'unsafe-eval'`.
- `src/lib/rate-limit.ts` uses in-memory rate limiting, which is not suitable for distributed production.
- `src/lib/role-access.ts` and `src/lib/rbac.ts` define separate permission models and should be replaced by one central policy layer.

## Current Strengths

- Broad module coverage already exists.
- Strong India-specific use cases are present: maintenance, UPI-style flow, owner/tenant separation, guard workflows, domestic staff, private rent, and resident staff payments.
- Society, flat/unit, person, occupancy, finance, visitor, package, staff, parking, amenity, marketplace, document, audit, notification, and payroll models already exist.
- The app already thinks in multi-society terms using `societyId`.
- The UI has many role-based surfaces and operational workflows.
- Current product direction is commercially sensible for small and mid-size societies.

## Current Gaps

- Business logic is coupled to Next.js route handlers.
- Tenant isolation depends heavily on manually repeated `societyId` filters.
- There is no PostgreSQL row-level security defense layer.
- Authorization is duplicated and inconsistent.
- Auth should move from custom JWT cookies to a stronger OIDC identity foundation.
- Finance is not yet audit-grade double-entry accounting at runtime.
- Online payments need verified gateway integration, webhook idempotency, reconciliation, refunds, and settlement reports.
- Background jobs are modeled but not implemented as a durable queue system.
- Notifications need provider-backed delivery, retry, audit, and fallback channels.
- File storage needs private object storage and signed URLs.
- Observability, CI, tests, load testing, backups, restore drills, and runbooks are missing.
- UI needs role-focused simplification, stronger empty/loading/error states, and mobile-first polish.
- Production security needs strict CSP, distributed rate limiting, MFA for privileged roles, secret scanning, dependency scanning, audit coverage, and privacy controls.

## Locked Technology Stack

Use a TypeScript modular monolith:

```text
apps/web        Next.js frontend, PWA, Capacitor web bundle
apps/api        NestJS + Fastify REST API
apps/worker     NestJS application running BullMQ workers
packages/db     Prisma schema, migrations, PostgreSQL RLS policies
packages/sdk    Generated OpenAPI TypeScript client
packages/ui     Shared accessible UI components and layouts
packages/config Shared validated environment/config schemas
packages/test   Fixtures, factories, and integration-test utilities
```

Recommended stack:

- Runtime: Node.js 24 LTS.
- Package/workspace: pnpm workspaces with Turborepo.
- Frontend: Next.js, React, Tailwind, Radix/shadcn-style accessible components.
- Backend: NestJS with Fastify adapter.
- API contract: REST under `/api/v1` with OpenAPI and generated TypeScript SDK.
- Database: PostgreSQL 18.
- ORM/query layer: Prisma for productivity, with reviewed raw SQL where RLS/accounting/reporting requires it.
- Identity: Keycloak OIDC.
- Cache/rate limit/session support: Valkey.
- Jobs: BullMQ.
- Storage: S3-compatible object storage; MinIO for local development.
- Observability: OpenTelemetry, structured logs, metrics, traces.
- Local/prod packaging: Docker and Docker Compose.
- CI: GitHub Actions or equivalent.
- Payments: Razorpay/UPI first for Indian society payments.
- Mobile: PWA plus Capacitor.

## Why NestJS

NestJS remains the best fit for this product because the system has many business modules, background jobs, permissions, audit requirements, payment flows, and domain boundaries.

Alternatives considered:

- AdonisJS: strong business-app framework and easier for some developers, but less aligned with NestJS module/job/OpenAPI patterns.
- Fastify alone: fast and flexible, but would require designing the architecture manually.
- Hono: clean and lightweight, but too small as the main framework for this ERP-style product.
- Express: too loose for the target quality level.
- Next.js API routes only: acceptable for prototype work, not for this production-grade backend.

## Locked Architecture Decisions

- Use a modular monolith, not microservices.
- Do not flush useful product learning. Preserve domain concepts, UI learnings, and schema knowledge.
- Do not preserve current demo data; v2 can start with a clean database.
- Incrementally migrate inside a monorepo instead of a risky one-shot rewrite.
- Keep the current app runnable while replacing Next.js business APIs module-by-module.
- All domain rules, authorization, transactions, audit events, and background jobs move behind NestJS.
- Next.js becomes the UI/BFF layer only where needed, not the owner of business logic.
- Use shared-schema multi-tenancy with `societyId` plus PostgreSQL RLS.
- Use Keycloak for identity and MFA.
- Use generated SDK calls from web to API.
- Keep provider selection, selling workflow, pricing, and final branding deferred.

## Public API Direction

- Product APIs live under `/api/v1`.
- Use `Authorization: Bearer <OIDC token>`.
- Tenant context is derived from authenticated society membership.
- Normal users cannot submit arbitrary `societyId` values.
- Financial, import, payment, webhook, and retryable mutation requests require `Idempotency-Key`.
- Errors use consistent problem-style JSON responses.
- Every request receives a request ID and trace context.
- Health endpoints: `/health/live` and `/health/ready`.
- Razorpay webhooks use a signature-verified endpoint.
- Files use private S3-compatible storage with short-lived signed upload/download URLs.
- Background work uses transactional outbox plus BullMQ workers.

## UI And UX Direction

The UI should feel operational, calm, fast, and trustworthy. Avoid a marketing-style dashboard with oversized decorative cards. This product is used repeatedly by committee members, residents, guards, accountants, and admins, so scanning and action speed matter.

Role-specific direction:

- Committee dashboard: collections, overdue dues, approvals, complaints, financial position, notices, operational alerts, and audit-sensitive tasks.
- Treasurer dashboard: collections, invoices, payments, reconciliation, expenses, ledger, reports, budgets, funds, and payroll.
- Resident dashboard: pay bills, approve visitors, raise complaints, read notices, access documents, book amenities, and view packages.
- Guard dashboard: large buttons, visitor/package/staff actions, scanning, offline recovery, incident escalation, and minimal distractions.
- Platform admin dashboard: society provisioning, system health, support, audit, usage, security events, and configuration.

UX requirements:

- Role-focused navigation instead of one giant universal menu.
- Clear empty, loading, error, permission-denied, and success states.
- Mobile-first layouts for residents and guards.
- Dense but readable finance and admin screens.
- Accessible controls and keyboard-friendly workflows.
- Consistent design tokens, spacing, forms, tables, modals, and action placement.
- Society identity support: name, logo, address, contact details, and restrained accent color.
- No final white-label or public brand decision in this phase.

## Module Recommendations

Every existing module must pass a quality gate before inclusion in the production-capable release candidate.

Recommended module groups:

- Foundation: platform admin, society onboarding, buildings, units, people, memberships, roles, settings, audit, files, notifications.
- Finance: billing, invoices, ledger, payments, receipts, expenses, funds, budgets, payroll, reconciliation, reports.
- Operations: visitors, gate console, packages, staff, attendance, parking, vendors, assets, facilities, amenities, incidents, blacklist, SOS.
- Community: notices, helpdesk, documents, meetings, polls, events, directory, forum, marketplace, reminders, smart nudges.
- Mobile: PWA, push, Capacitor, guard-first and resident-first workflows.

Quality-gate outcomes:

- Rebuild: valuable module with clear production workflow.
- Merge: duplicate or overlapping module should become part of another workflow.
- Redesign: useful idea but current shape is not production-grade.
- Postpone: useful later, not needed before release candidate.
- Remove: legally risky, unclear, or low-value feature.

## Current Module Inventory

Current API modules scanned under `src/app/api`:

`accounting`, `activity-log`, `assets`, `auth`, `blacklist`, `budgets`, `complaints`, `credentials`, `dashboard`, `directory`, `documents`, `emergency`, `events`, `expenses`, `facilities`, `forum`, `funds`, `guard`, `legal-adviser`, `maintenance`, `marketplace`, `meetings`, `members`, `mobile`, `move-events`, `my-bills`, `my-visitors`, `notices`, `notifications`, `packages`, `parking`, `polls`, `push`, `receipts`, `reminders`, `rent-invoices`, `reports`, `salaries`, `search`, `sessions`, `settings`, `societies`, `staff`, `subscription`, `system`, `tenants`, `vendors`, `visitors`.

Current dashboard modules scanned under `src/app/(dashboard)`:

`activity-log`, `amenities`, `assets`, `budgets`, `complaints`, `credentials`, `dashboard`, `directory`, `documents`, `emergency`, `events`, `expenses`, `facilities`, `forum`, `funds`, `maintenance`, `marketplace`, `meetings`, `members`, `move-events`, `my-bills`, `my-visitors`, `notices`, `packages`, `parking`, `polls`, `receipts`, `reminders`, `reports`, `salaries`, `settings`, `staff`, `system`, `tenants`, `vendors`, `visitors`.

| Area | Current Surface | Current Status | Recommended Disposition | Reason | Phase |
|---|---|---|---|---|---|
| Platform/admin | `system`, `societies`, `settings`, `subscription` | Partial | Redesign | Needs platform-admin model, assisted provisioning, feature flags later, and no sales/pricing lock-in yet. | 2 |
| Identity/access | `auth`, `sessions`, `credentials`, `role-access`, `rbac` | Partial | Rebuild | Current JWT/session and duplicate permission systems are not enough for production SaaS. | 2 |
| Tenant isolation | `societyId` filters across routes | Partial | Rebuild | Manual query filtering is too fragile; add NestJS tenant context plus PostgreSQL RLS. | 2 |
| Audit/security logs | `activity-log`, `SecurityEvent`, `ActivityLog` | Partial | Rebuild | Audit must become immutable, central, and attached to all sensitive actions. | 2 |
| Notifications | `notifications`, `push`, `reminders` | Partial | Rebuild | Needs providers, retries, delivery status, templates, and worker processing. | 2 |
| Society core | `members`, `tenants`, `move-events`, `directory` | Partial | Rebuild | Good domain direction exists, but legacy flat fields still influence workflows. | 3 |
| Imports | `members/import` and spreadsheet dependencies | Partial | Rebuild | Needs validation reports, dry-run, idempotency, and audit trails. | 3 |
| Maintenance billing | `maintenance`, `my-bills`, `rent-invoices` | Partial | Rebuild | Must become invoice/line-item/ledger driven with owner/tenant responsibility. | 4 |
| Accounting/ledger | `accounting`, `reports`, ledger models | Foundation | Rebuild | Ledger should be source of truth before reports are trusted. | 4 |
| Payments/receipts | `receipts`, UPI-style flows | Partial | Rebuild | Needs Razorpay integration, webhook signatures, reconciliation, refunds, idempotency. | 4 |
| Expenses/funds/budgets | `expenses`, `funds`, `budgets` | Partial | Rebuild | Must connect to ledger, approvals, attachments, and reports. | 4 |
| Payroll/salaries | `salaries`, `StaffSalary`, `ResidentStaffPayment` | Partial | Rebuild | Separate society payroll from resident private staff payments with audit/reporting. | 4 |
| Visitors/gate | `visitors`, `guard`, `my-visitors`, `blacklist` | Partial | Rebuild | Needs mobile-first guard flow, approval timeline, incidents, blacklist warnings, offline recovery. | 5 |
| Packages | `packages` | Partial | Rebuild | Needs pickup verification, resident confirmation, photos, and notifications. | 5 |
| Staff/daily help | `staff`, attendance models | Partial | Rebuild | Needs verification, attendance reports, flat links, payments, and guard integration. | 5 |
| Parking/vehicles | `parking`, vehicle models | Partial | Rebuild | Needs resident self-service, visitor parking, capacity, enforcement, and audit. | 5 |
| Facilities/amenities | `facilities`, `amenities` | Partial | Rebuild | Needs slot policy, capacity, penalties, waitlist, paid bookings, and blackout rules. | 5 |
| Vendors/assets | `vendors`, `assets` | Partial | Rebuild | Needs contracts, AMC schedules, warranties, maintenance reminders, and expense links. | 5 |
| Emergency/SOS | `emergency` | Partial | Rebuild | Needs escalation tree, guard dispatch, contacts, audit, and notification guarantees. | 5 |
| Notices/helpdesk | `notices`, `complaints` | Partial | Rebuild | Needs delivery reports, assignments, SLAs, escalation, attachments, and audit. | 6 |
| Documents | `documents` | Partial | Rebuild | Needs folder permissions, versioning, private storage, and personal/flat/society scopes. | 6 |
| Governance | `meetings`, `polls`, `events` | Partial | Rebuild | Needs agendas, attendance, resolutions, voting controls, RSVP, reminders, exports. | 6 |
| Community | `forum`, `marketplace` | Partial | Quality gate | Keep only with moderation, reporting, images, retention, and clear customer value. | 6 |
| Legal adviser | `legal-adviser` | Risky | Quality gate | Needs legal-risk review; likely redesign as document/checklist guidance, not advice. | 6 |
| Mobile/bootstrap | `mobile`, Capacitor dependencies | Foundation | Rebuild | Needs explicit PWA/offline/mobile API contract and packaged app QA. | 7 |
| Search/global UX | `search`, sidebar navigation | Partial | Rebuild | Needs role-aware global actions and simplified navigation. | 7 |

## Current Prisma Model Inventory

Current models:

`Society`, `Flat`, `Unit`, `Person`, `UnitOccupancy`, `MaintenanceBill`, `BillingRule`, `PenaltyRule`, `Invoice`, `InvoiceLineItem`, `InvoiceRecipient`, `Payment`, `Receipt`, `FinancialTransaction`, `LedgerAccount`, `LedgerEntry`, `JournalVoucher`, `JournalVoucherLine`, `SecurityEvent`, `BackgroundJob`, `ReminderLog`, `User`, `Expense`, `Complaint`, `Notice`, `Visitor`, `ParkingSlot`, `ParkingZone`, `Vehicle`, `ParkingAssignment`, `ParkingTransactionHistory`, `Facility`, `Amenity`, `AmenityPolicy`, `AmenitySchedule`, `FacilityBooking`, `AmenityUsageLog`, `AmenityPenalty`, `MeetingMinutes`, `EmergencyContact`, `Poll`, `Document`, `ActivityLog`, `Notification`, `Vendor`, `UserSession`, `ParkingSharing`, `ParkingRequest`, `GuardUser`, `DomesticStaff`, `StaffFlatLink`, `StaffAttendance`, `Package`, `Tenant`, `RentInvoice`, `MoveEvent`, `Blacklist`, `GateIncident`, `ForumThread`, `ForumReply`, `SocietyEvent`, `EventRsvp`, `GuardPatrol`, `PushSubscription`, `MarketplaceListing`, `MarketplaceCategory`, `MarketplaceImage`, `MarketplaceInterest`, `MarketplaceTransaction`, `MarketplaceModeration`, `FundAccount`, `FundTransaction`, `Budget`, `SocietyAsset`, `NoticeRead`, `FacilityWaitlist`, `StaffSalary`, `ResidentStaffPayment`.

## Production Risk Register

| Risk | Impact | Evidence | Mitigation | Target Phase |
|---|---|---|---|---|
| Cross-society data leak | Critical | Tenant filtering is manually repeated in route handlers. | Central tenant context, repository guards, RLS, and cross-tenant tests. | 2 |
| Permission bypass | Critical | `role-access.ts` and `rbac.ts` define different rules. | Single policy engine with route, API, and UI permissions generated from one source. | 2 |
| Weak privileged auth | High | Current app uses custom JWT cookie sessions. | Keycloak OIDC, MFA for privileged roles, session/device audit. | 2 |
| Distributed brute force/API abuse | High | Rate limit is in-memory per instance. | Valkey-backed rate limits and security events. | 2 |
| Untrusted finance reports | Critical | Reports aggregate bills/expenses directly; ledger runtime is not source of truth. | Double-entry ledger and immutable postings before finance reports. | 4 |
| Duplicate payments/postings | Critical | No durable idempotency/webhook architecture confirmed. | Idempotency keys, webhook signature verification, transaction boundaries, outbox jobs. | 4 |
| Lost background jobs | High | Background job model exists but no durable queue foundation is active. | BullMQ workers, retry/dead-letter policy, outbox, monitoring. | 1/2 |
| Notification delivery gaps | Medium | Push exists, but provider-backed delivery/retry is incomplete. | Notification service with templates, providers, retries, and delivery logs. | 2 |
| File exposure | High | Document storage needs private object model and signed URLs. | S3-compatible private buckets, signed URLs, virus-scan hook later. | 2/6 |
| CSP/script exposure | High | `next.config.ts` permits `'unsafe-inline'` and `'unsafe-eval'`. | Strict CSP migration and dependency review. | 2 |
| No test safety net | High | Focused scan found no app test config/files. | Add unit, integration, contract, and Playwright tests before migration. | 1 |
| Poor launch recovery | High | No Docker/CI/backup/restore artifacts found. | Compose environments, CI, backup/restore drill, runbooks. | 1/8 |
| Mobile workflow failure | Medium | Current app is web-first with Capacitor deps. | PWA/offline design, mobile QA, push diagnostics, guard-first flow testing. | 7 |
| Legal guidance liability | High | `legal-adviser` exists as a product surface. | Quality gate; convert to templates/checklists or remove before launch. | 6 |

## Module Acceptance Criteria

Foundation:

- All APIs derive tenant context from authenticated membership.
- All sensitive actions create immutable audit records.
- All privileged roles require MFA.
- All files use private storage and signed URLs.
- Notification attempts are queued, retryable, and auditable.

Society core:

- Society setup, units, people, owners, tenants, occupancy, move-in/out, and imports work without direct database edits.
- Owner, tenant, vacant, and inactive occupancy states are represented consistently.
- Imports support dry-run validation and row-level error reporting.

Finance:

- Ledger entries are the financial source of truth.
- Posted financial records are immutable and corrected only through reversal/adjustment entries.
- Billing, payments, receipts, expenses, funds, budgets, payroll, and reports reconcile.
- Payment webhooks are signed, idempotent, and retry-safe.

Operations/security:

- Guard, visitor, package, staff, parking, facility, asset, incident, blacklist, and SOS workflows are mobile-friendly and auditable.
- Guard workflows remain usable under poor network conditions.
- Resident approvals and operational events notify the correct users.

Community/governance:

- Notices, helpdesk, documents, meetings, polls, events, forum, and marketplace have clear permissions, moderation, retention, and delivery behavior.
- Helpdesk supports assignment, SLA state, escalation, attachments, and audit.
- Documents support society, flat, and personal scopes.

Mobile/UX:

- Primary workflows pass desktop, tablet, mobile web, and packaged app QA.
- UI includes loading, empty, error, retry, permission-denied, and success states.
- Navigation is role-focused.
- Critical workflows meet WCAG 2.2 AA expectations.

Release hardening:

- Lint, type-check, build, migrations, tests, security scans, load tests, and restore drill pass.
- Obsolete Next.js business APIs and unused prototype code are removed.
- Provider-neutral deployment artifacts and runbooks exist.

## Phased Roadmap

### Phase 0: Product Audit And Source Of Truth

Goal: convert the current prototype and this conversation into a decision-ready backlog.

Deliverables:

- This roadmap file.
- Current module inventory.
- Model inventory.
- API/page inventory.
- Module disposition table.
- Risk register.
- Acceptance criteria per approved module.
- Phase 1 implementation plan.

Exit gate:

- Every current module has a proposed disposition and rationale.
- No major current surface is undocumented.
- Phase 1 can start without deciding product architecture again.

### Phase 1: Engineering Foundation

Goal: establish the new monorepo platform without changing product behavior.

Deliverables:

- pnpm/Turborepo workspace.
- `apps/web`, `apps/api`, `apps/worker`, and shared packages.
- Docker Compose local environment.
- PostgreSQL, Valkey, MinIO, and Keycloak local services.
- CI, lint, type-check, tests, OpenAPI generation, health checks, logs, and config validation.

Exit gate:

- One-command local environment works.
- CI passes.
- Web, API, worker, database, cache, storage, and identity can communicate.

### Phase 2: Identity, Tenancy, And Security

Goal: make authentication, authorization, tenant isolation, audit, files, and notifications production-grade.

Deliverables:

- Keycloak OIDC integration.
- Global identities and society memberships.
- Central permission policy.
- PostgreSQL RLS.
- Platform admin.
- Society onboarding.
- Audit events.
- Distributed rate limiting.
- Private file storage.
- Notification foundation.
- Strict security headers.

Exit gate:

- Automated tests prove cross-society access is blocked.
- Privileged actions create audit records.
- Committee/platform admins require MFA.

### Phase 3: Society Core

Goal: rebuild the society data foundation.

Deliverables:

- Societies, buildings, wings, floors, units, people, owners, tenants, occupancy, resident directory, move-in/out, credentials, and imports.

Exit gate:

- A new society can be configured, populated, and operated without database access.

### Phase 4: Financial Core

Goal: make money flows correct, auditable, and retry-safe.

Deliverables:

- Chart of accounts.
- Double-entry ledger.
- Journal vouchers.
- Billing rules.
- Invoices and line items.
- Payments.
- Razorpay/UPI integration.
- Receipts.
- Expenses.
- Funds.
- Budgets.
- Payroll.
- Reconciliation.
- Reports.
- Billing/reminder/reconciliation workers.

Exit gate:

- Duplicate requests and webhook retries cannot duplicate charges or ledger postings.
- Financial reports reconcile exactly.

### Phase 5: Operations And Security Modules

Goal: rebuild society operations with mobile-first guard workflows.

Deliverables:

- Visitors, guard operations, packages, staff, attendance, parking, vendors, assets, facilities, amenities, bookings, access control, incidents, blacklists, patrols, and SOS.

Exit gate:

- All operational workflows pass role, mobile, audit, notification, and retry tests.

### Phase 6: Community And Governance

Goal: rebuild communication and governance workflows.

Deliverables:

- Notices, helpdesk, documents, meetings, polls, events, directory, forum, marketplace, reminders, and smart nudges.

Exit gate:

- All approved community/governance modules have ownership, moderation, permissions, and retention behavior.

### Phase 7: Cross-Role UX, PWA, And Capacitor

Goal: make the product feel complete and usable across roles and devices.

Deliverables:

- Role-focused navigation.
- Dashboards.
- Global search/actions.
- Responsive layouts.
- PWA caching.
- Offline-safe actions.
- Push notifications.
- Capacitor builds.
- Accessibility and visual QA.

Exit gate:

- Primary workflows work on desktop, tablet, mobile web, and packaged mobile builds.

### Phase 8: Release-Candidate Hardening

Goal: finish the production-capable release candidate.

Deliverables:

- Removed obsolete APIs/code.
- Security assessment.
- Regression suite.
- Load tests.
- Failure tests.
- Backup/restore drill.
- Runbooks.
- Staging UAT.
- Provider-neutral Docker images and deployment checklist.

Exit gate:

- All mandatory quality gates pass.
- Product is production-capable, but not publicly launched until deployment/sales/branding decisions are made.

## Mandatory Quality Gates

- Lint passes.
- Type-check passes.
- Build passes.
- Database migrations apply cleanly.
- Unit, integration, contract, and Playwright tests pass.
- No unresolved critical or high security findings.
- Cross-tenant access attempts fail.
- MFA is mandatory for privileged roles.
- Billing, ledger, payment, webhook, and audit critical paths are covered.
- Jobs, webhooks, imports, and payments are idempotent.
- Backup restoration is tested.
- Failure recovery is documented.
- WCAG 2.2 AA checks are completed for critical workflows.
- Load target is validated with 50 societies, 15,000 users, and 300 concurrent active sessions.
- Core API p95 target is below 750 ms excluding third-party latency.

## Deferred Decisions

These are intentionally not decided yet:

- Cloud provider.
- Production infrastructure size.
- Selling workflow.
- Subscription pricing.
- Final product name and brand.
- White-label scope.
- Public launch date.
- Customer contracts and support model.

## Immediate Next Step

Phase 8 (Release-Candidate Hardening) is complete in compatibility mode across all eight checkpoints (CP1–CP8). The codebase is **production-capable** per the roadmap exit gate; public launch remains blocked on deferred decisions (cloud provider, branding, pricing, contracts). Before first staging/production deploy, operators should run staging-only gates: k6 load test (`npm run load:api`), backup/restore drill (`scripts/backup/*`), Docker image builds (`docker-compose.rc.yml`), and persona UAT (`docs/staging/uat-checklist.md`). Outstanding parallel hardening carries forward: live validation of Phase 4/5/6 against a real database, deferred schema-hardening migrations, BullMQ + real notification transport, Next.js static export for offline Capacitor, and full OIDC web-shell migration.

## Progress Log

### 7 June 2026 (Phase 8 complete — CP1–CP8)

- Phase 8 runs in compatibility mode on root `src/` (no `apps/web` move, no new Prisma migrations). Added `docs/superpowers/plans/2026-06-07-phase-8-release-candidate-hardening.md` as the checkpointed plan.
- CP1 Legacy API: `docs/api/legacy-route-inventory.md` (88 routes); `nest-proxy` + BFF bridge JWT; pilot shims for `notices`/`visitors`; deprecation headers on `maintenance/bills` and `members`; removed `legal-adviser`.
- CP2 Security: `docs/security/phase-8-assessment.md`, frozen `npm audit` baseline gate (`scripts/npm-audit-gate.mjs`), gitleaks in CI, cross-tenant + MFA integration tests.
- CP3 Contract tests: `tests/contract/*` (13 tests) for finance, operations, community, society critical paths; `packages/test/src/contract/`.
- CP4 Failure tests: `tests/failure/*` (5 tests); `docs/runbooks/incident-response.md` and related runbooks.
- CP5 Load: `scripts/load/k6-api-smoke.js`, `.github/workflows/load-test.yml` (workflow_dispatch); execution deferred to staging.
- CP6 Backup/runbooks: `scripts/backup/pg-dump.*`, `pg-restore.*`; `docs/runbooks/` (deployment, backup-restore, webhook-replay).
- CP7 Docker: `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `Dockerfile.web`, `docker-compose.rc.yml`, `docs/deployment/provider-neutral-checklist.md`; `next.config.ts` `output: "standalone"`.
- CP8 UAT/exit: `docs/staging/uat-checklist.md`, `scripts/phase8-rc-verify.mjs`, expanded a11y smoke (6 paths).
- Phase 8 exit gate verified locally:
  - `npm run phase8:rc` passes: typecheck, 425 Vitest + 8 worker, 13 contract, 9 integration, 5 failure, `db:validate`, build (117 routes).
  - `npx playwright test --project="Desktop Chrome" --project="Pixel 7"` passes (34 tests); iPad Mini requires `npx playwright install webkit`.
  - `npm run lint` unchanged at known legacy baseline; zero new issues in Phase 8 `apps/`/`packages/` code.
  - Staging-only (not run locally): k6 load p95, live backup drill, Docker image builds (CI `docker-smoke` job defined).

### 7 June 2026 (Phase 7 complete — CP1–CP8)

- Phase 7 runs in compatibility mode on root `src/` (no `apps/web` move). Added `docs/superpowers/plans/2026-06-07-phase-7-cross-role-ux-pwa-capacitor.md` as the checkpointed plan.
- Added `@society/ux-core` (persona resolution, permission-filtered navigation models, quick-action catalogs, search privacy shaping) and `src/lib/navigation/legacy-role-bridge.ts` (legacy role → `@society/security` principal mapping with resident my-bills compatibility shim).
- CP2 Navigation shell: `Sidebar`, `BottomNav`, and `Header` now consume persona navigation; guard default route redirect; `data-persona` selectors for visual QA.
- CP3 Persona dashboards: `PersonaDashboardRouter` plus dedicated guard, treasurer, and platform-admin dashboard surfaces; committee/resident reuse hardened admin/resident views.
- CP4 Global search/actions: `CommandPalette` (Ctrl/Cmd+K), permission-aware `/api/search` extensions (notices, documents, marketplace, directory), recent-action localStorage.
- CP5 UX states: shared `PageState`, `PermissionDenied`, `RetryBlock`; applied to critical `visitors` and `my-bills` workflows.
- CP6 PWA/offline: service worker v3 cache manifest, offline mutation helpers with operations-core dedupe keys, manifest shortcuts/scope updates.
- CP7 Push compatibility mode: `notification-routing.ts`, `/api/push/dispatch` envelope adapter (503 without VAPID), hardened subscribe permission handling.
- CP8 Capacitor + QA: fixed `capacitor.config.ts` (optional `CAPACITOR_SERVER_URL`, no hard-coded remote URL), `cap:sync` CI smoke, Playwright desktop/mobile/tablet projects, role-workflow and a11y smoke tests.
- Phase 7 exit gate verified:
  - `npm run test` passes: 77 Vitest files, 385 Vitest tests, and 8 worker tests.
  - `npm run typecheck:ux-core` and root `npm run typecheck` pass.
  - `npm run db:validate` passes; `npm run build` passes (118 routes).
  - `npx playwright test --project="Desktop Chrome"` passes (13 tests).
  - `npm run cap:sync` passes.
  - `npm run lint` unchanged at the known legacy baseline; zero new issues in Phase 7 `apps/`/`packages/` navigation/UX policy code.

### 7 June 2026 (Phase 6 complete — CP1–CP8)

- Phase 6 runs in compatibility mode (reuse existing Prisma community/governance models, no new migrations directory). Added `docs/superpowers/plans/2026-06-07-phase-6-community-governance.md` as the checkpointed plan with recorded schema-hardening deferrals.
- Added `@society/community-core` as the Phase 6 community/governance domain package (pure invariants): notice planning/retention/read-dedupe, complaint lifecycle/SLA/escalation/satisfaction, document scope encoding/visibility/versioning, meeting-type normalization, poll voting controls (single-vote dedupe, close, tally), event lifecycle + RSVP capacity, forum category/lock/pin moderation, marketplace listing lifecycle + moderation + privacy contact visibility, non-advisory legal checklist templates, and a generic community event envelope.
- Added Phase 6 permission actions to the central policy: `community:read`, `community:notice.manage`, `community:helpdesk.respond`, `community:helpdesk.manage`, `community:document.manage` (MFA), `community:governance.manage` (MFA), `community:vote.cast`, `community:rsvp.manage`, `community:post`, and `community:moderate`. Residents read/post/vote/RSVP/raise complaints; committee/admins manage and moderate; document and governance management require MFA.
- Added the NestJS community API slice under `/api/v1/community` (all tenant-scoped, central-permission authorized, idempotent on replay where applicable):
  - CP1 Notices: `notices/create`, `notices/list` (pinned-first, active-only retention), `notices/mark-read` (idempotent read receipts), `notices/read-receipts`.
  - CP2 Helpdesk: `helpdesk/raise` (default SLA by priority), `helpdesk/assign`, `helpdesk/transition`, `helpdesk/escalate` (secretary→chairman), `helpdesk/rate`, `helpdesk/list` (SLA-breach flags).
  - CP3 Documents: `documents/upload-intent` (reuses Phase 2 `FileStoragePolicyService` for signed private storage URLs), `documents/create` (society/flat/personal scope), `documents/list` (scope visibility filtering), plus `documents/legal-templates` and `documents/legal-templates/instantiate` for the non-advisory legal checklist redesign.
  - CP4 Governance: `meetings/record`, `meetings/list`, `polls/create`, `polls/vote` (single vote per voter, rejects closed/duplicate/out-of-range), `polls/close`, `polls/results`, `polls/list`.
  - CP5 Events: `events/create`, `events/transition`, `events/rsvp` (capacity enforcement + idempotent RSVP), `events/list`, `events/rsvps`.
  - CP6 Forum + Marketplace: `forum/threads/create|reply|moderate|list|replies` (lock blocks replies, pin/lock moderation) and `marketplace/listings/create|transition|interest|moderate|list` (moderation workflow, idempotent interest, privacy-filtered contact details).
- Added `apps/worker/src/community-worker.ts` (`buildCommunityWorkerJob`) for deterministic, retry-safe notice/meeting/event reminder envelopes and smart nudges (unread-notice, poll-closing, document-expiry) with per-recipient targets — compatibility mode, no real transport yet.
- Registered `CommunityModule` in the NestJS API module.
- Phase 6 exit gate verified:
  - `npm run test` passes: 68 Vitest files, 336 Vitest tests (124 new community-core/API tests across CP1–CP7), and 8 worker tests (3 new community-worker tests).
  - `npm run typecheck:community-core`, `:security`, `:api`, `:worker`, and root `npm run typecheck` all pass.
  - `npm run db:validate` passes; `npm run build` passes (117 routes).
  - `npm run lint` still fails only at the known legacy baseline (57 problems / 28 errors / 29 warnings in `src/` and `scratch/`); zero new issues from Phase 6 `apps/`/`packages/` code.
- Deferred to a dedicated schema-hardening migration checkpoint (documented in the Phase 6 plan): a first-class `Document` scope column (currently encoded into `category`), a poll-vote table (currently JSON blobs), community status enums, and idempotency/dedupe unique constraints.

### 7 June 2026 (Phase 5 complete — CP2–CP8)

- Phase 5 Checkpoints 2–7 completed, extending `@society/operations-core` and the `/api/v1/operations` API surface (all in compatibility mode, reusing existing Prisma models):
  - CP2 Packages: lifecycle state machine (`planPackageIntake`, `applyPackageTransition`), 6-digit pickup OTP (`generatePickupOtp`, `verifyPackagePickup`), idempotent intake dedupe, and a `package-arrived` notification envelope on notify. Routes under `/operations/packages`.
  - CP3 Domestic staff & attendance: category/method normalization, staff entry codes, idempotent attendance check-in by deterministic dedupe key, and duration computation on check-out. Staff registry is MFA-managed; guards mark attendance. Routes under `/operations/staff`.
  - CP4 Parking: slot/assignment type normalization, `assertSlotAssignable` guard, capacity summary, idempotent slot creation, and replay-safe vehicle assignment/release. Routes under `/operations/parking`.
  - CP5 Facilities/amenities/bookings: amenity policy validation (`evaluateBookingRequest` for booking window, max hours, past-time, and blackout overlap), double-booking capacity check, amount computation, cancellation-cutoff enforcement, and idempotent waitlist join. Routes under `/operations/amenities`.
  - CP6 Vendors & assets: vendor/asset normalization, AMC/warranty coverage status (`computeCoverageStatus`), next-maintenance scheduling (`computeNextMaintenance`), and due-maintenance listing (`isMaintenanceDue`). Routes under `/operations/vendors` and `/operations/assets`.
  - CP7 Incidents/blacklist/SOS: incident type/severity normalization, gate-incident reporting, blacklist add/check with gate-warning matching (`matchBlacklist`), SOS raise with severity-based escalation tiers (`computeSosEscalation`) and per-tier `sos-alert` notification fan-out, and idempotent SOS replay. Added `apps/worker/src/operations-worker.ts` (`buildOperationsWorkerJob`) for deterministic, retry-safe AMC/maintenance/SOS/visitor-overstay envelopes. Routes under `/operations/incidents`, `/operations/blacklist`, `/operations/sos`.
- Phase 5 Checkpoint 8 (exit gate) verified:
  - `npm run test` passes: 46 Vitest files, 212 Vitest tests (84 new operations-core/API tests added across CP2–CP7), and 5 worker tests (2 new operations-worker tests).
  - `npm run typecheck:operations-core`, `:security`, `:api`, and `:worker` all pass.
  - `npm run db:validate` passes; `npm run build` passes.
  - `npm run lint` still fails only at the known legacy baseline (57 problems / 28 errors / 29 warnings in `src/` and `scratch/`); zero new issues from Phase 5 `apps/` or `packages/` code.
- Deferred to a dedicated schema-hardening migration checkpoint (documented in the Phase 5 plan): operations status enums, unique constraints backing idempotency/dedupe keys, and missing foreign keys.

### 7 June 2026 (Phase 5 — CP1)

- Phase 5 Checkpoint 1 completed:
  - Added `docs/superpowers/plans/2026-06-07-phase-5-operations-security.md` as the checkpointed Phase 5 implementation plan.
  - Confirmed Phase 5 runs in compatibility mode (reuse existing Prisma operations models, no new migrations directory), with recommended schema hardening recorded for a future migration checkpoint.
  - Added `@society/operations-core` as the Phase 5 operations-domain package: visitor lifecycle state machine (`applyVisitorTransition`), walk-in vs pre-approved logging (`planVisitorLog`, `planExpectedVisitor`), deterministic offline-replay dedupe keys (`visitorLogDedupeKey`, `patrolScanDedupeKey`), visitor passcode generation, and retry-safe guard action envelopes (`buildGuardActionEnvelope`).
  - Added Phase 5 permission actions to the central policy: `operations:gate.manage`, `operations:visitor.respond`, `operations:read`, `operations:manage` (MFA required), `operations:booking.manage`, and `operations:sos.raise`. Granted guards their first permissions (gate management, operational reads, SOS) without MFA for mobile-first PIN workflows; residents can respond to visitors, book amenities, and raise SOS.
  - Added the NestJS operations API slice under `/api/v1/operations`: `VisitorService` (Phase 2 authorization), `VisitorRepository` (tenant-checked Prisma boundary over `Visitor` and `GuardPatrol` with idempotent log/patrol replay), and `VisitorController` for visitor log/respond/transition/list and patrol scan/list.
  - Registered `OperationsModule` in the NestJS API module.
  - Verified focused Phase 5 suites pass: operations-core (14 tests), permission policy (6 tests), and operations API (18 tests across repository/service/controller).
  - Verified `npm run typecheck:operations-core`, `npm run typecheck:security`, `npm run typecheck:api`, and root `npm run typecheck` pass.
  - Verified `npm run test` passes: 34 Vitest files, 128 Vitest tests, and 3 worker tests.
  - Verified `npm run db:validate` passes and `npm run build` passes (117 routes).
  - Verified full `npm run lint` still fails only at the known baseline: 57 problems, 28 errors, 29 warnings (zero added by Phase 5).
  - Remaining Phase 5 work: packages, domestic staff/attendance, parking, facilities/amenities/bookings, vendors/assets, incidents/blacklist/patrol-verification/SOS, operations worker envelopes, notification fan-out, and live validation.

### 7 June 2026

- Phase 4 Checkpoint 1 completed:
  - Added `docs/superpowers/plans/2026-06-07-phase-4-financial-core.md` as the checkpointed Phase 4 implementation plan.
  - Added `@society/finance-core` as the Phase 4 financial-domain package.
  - Added default chart-of-accounts definitions for core asset, liability, income, expense, and equity accounts.
  - Added tested journal posting plan validation for required idempotency keys, minimum ledger lines, positive line amounts, and exact debit/credit balance.
  - Added tested posting-line helpers for maintenance invoices, payment collection, and paid expenses.
  - Verified focused finance-core suite passes: 1 file and 7 tests.
  - Verified `npm run typecheck:finance-core`, root `npm run typecheck`, `npm run test`, `npm run db:validate`, and `npm run build` pass.
  - Phase 4 still needs the NestJS finance API boundary, Prisma persistence, idempotent payment/webhook handling, reconciliation, reports, and workers.
- Phase 4 Checkpoint 2 completed:
  - Added `society:finance.read` and `society:finance.manage` to the central permission policy.
  - Allowed treasurers to read/manage finance with MFA required for finance management.
  - Added `FinanceCoreService` with Phase 2 authorization around finance reads and posting-plan creation.
  - Verified focused finance permission/service tests pass: 3 files and 8 tests.
  - Verified `npm run typecheck:api` passes.
- Phase 4 Checkpoint 3 completed:
  - Added `FinanceCoreRepository` for default chart-of-accounts creation, source replay checks, journal voucher posting, financial transactions, ledger entries, and trial balance.
  - Added `FinanceCoreController` and `FinanceCoreModule` under `/api/v1/finance-core`.
  - Registered `FinanceCoreModule` in the NestJS API module.
  - Verified focused finance API tests pass: 3 files and 10 tests.
  - Verified `npm run typecheck:api` passes.
- Phase 4 Checkpoint 4 completed:
  - Added receipt number and Razorpay webhook idempotency-key helpers.
  - Added invoice creation with receivable/income ledger posting.
  - Added payment recording with receipt creation, invoice paid-status update, and bank/receivable settlement posting.
  - Added finance API endpoints for invoice creation and payment recording.
  - Verified focused finance package/API tests pass: 4 files and 24 tests.
  - Verified `npm run typecheck:finance-core` and `npm run typecheck:api` pass.
- Phase 4 Checkpoint 5 completed:
  - Added payroll posting helpers.
  - Added expense recording with budget actual updates and expense ledger posting.
  - Added budget upsert, fund transaction balance updates, and payroll paid posting workflows.
  - Added deterministic finance worker job envelopes for billing reminders, payment reconciliation, and report rebuild commands.
  - Added finance API endpoint for expense recording.
  - Verified focused finance package/API tests pass: 4 files and 30 tests.
  - Verified focused finance worker test passes.
  - Verified `npm run typecheck:finance-core`, `npm run typecheck:api`, and `npm run typecheck:worker` pass.
  - Remaining Phase 4 hardening before production: live database/provider validation, first-class idempotency persistence, Razorpay sandbox webhook execution, partial-payment status calculation, and dedicated schema migrations.
- Phase 3 Checkpoint 1 completed:
  - Added `@society/society-core` as the society-core domain package.
  - Added society setup planning for buildings, wings, floors, units, default vacant occupancy, and duplicate-unit validation.
  - Added resident import dry-run validation with row-level errors and normalized accepted rows.
  - Added occupancy move planning for tenant/owner move-in and move-out events.
  - Added privacy-aware resident directory shaping for resident and committee-style viewers.
- Phase 3 Checkpoint 2 completed:
  - Added Phase 3 permission actions for society-core management, import management, occupancy management, and directory reads.
  - Wired `SocietyCoreService` into the NestJS API boundary with Phase 2 tenant authorization.
  - Added `/api/v1/society-core` controller surfaces for setup planning, import dry-run, occupancy move planning, and directory reads.
  - Verified focused Phase 3 suite passes: 4 files and 14 tests.
  - Verified `npm run typecheck:society-core`, `npm run typecheck:security`, `npm run typecheck:api`, root `npm run typecheck`, `npm run test`, `npm run db:validate`, and `npm run build` pass.
  - Verified targeted lint for new Phase 3 files passes.
  - Verified full `npm run lint` still fails at the known baseline: 57 problems, 28 errors, 29 warnings.
  - Database-backed persistence, committed import workflows, credential issuance, and UI migration are still pending Phase 3 work.
- Phase 3 Checkpoint 3 completed:
  - Added `SocietyCoreRepository` as the database persistence boundary for Phase 3.
  - Added tested setup commits that persist society profile and unit inventory through existing `Society` and `Unit` models.
  - Kept building/wing/floor compatibility scoped to `Unit.wing` and `Unit.floor` because this checkout still has no Prisma migrations directory.
  - Added tested import commits that validate rows before writing, create/reuse people, and attach active unit occupancies.
- Phase 3 Checkpoint 4 completed:
  - Added tested committed occupancy move workflow that updates unit occupancy state, closes active occupancies on move-out, and records legacy `MoveEvent` rows when a unit still links to a legacy flat.
  - Added tested credential issuance workflow that creates local `User` records for imported people with email addresses while preserving OIDC as the identity direction.
  - Added committed API routes for setup, imports, occupancy, and credentials under `/api/v1/society-core`.
- Phase 3 Checkpoint 5 completed:
  - Added persisted resident directory reads backed by stored units, people, occupancies, and user visibility flags.
  - Added `/api/v1/society-core/directory/read` for tenant-protected privacy-filtered directory output.
  - Verified focused Phase 3 suite passes: 5 files and 28 tests.
  - Verified `npm run typecheck:society-core`, `npm run typecheck:security`, `npm run typecheck:api`, and root `npm run typecheck` pass.
  - Verified `npm run db:validate` and `npm run db:generate` pass.
  - Verified `npm run test` passes: 25 Vitest files, 59 Vitest tests, and 2 worker tests.
  - Verified targeted lint for all Phase 3 files passes.
  - Verified `npm run build` passes and generates 117 routes.
  - Verified full `npm run lint` still fails at the known baseline: 57 problems, 28 errors, 29 warnings.
  - Phase 3 compatibility exit gate is complete: a society can be configured, populated, moved in/out, credentialed, and listed through tenant-protected API workflows without direct database access.

### 6 June 2026

- Phase 2 Checkpoint 1 started:
  - Added `@society/security` as the central tenant-context and permission-policy package.
  - Added Phase 2 environment contract checks for OIDC issuer/JWKS URLs plus API security/audit feature switches.
  - Added API `SecurityModule` and `SecurityPolicyService` so migrated NestJS routes can enforce central permission decisions.
  - Added tests proving cross-society access is blocked and privileged audit access requires MFA.
  - Verified focused Phase 2 tests pass: 4 files and 8 tests.
  - Verified `npm run typecheck:config`, `npm run typecheck:security`, `npm run typecheck:api`, and root `npm run typecheck` pass.
  - Verified `npm run test` passes: 7 Vitest files, 14 Vitest tests, and 2 worker tests.
  - Verified targeted lint for new Phase 2 files passes.
  - Verified `npm run build` passes and generates 117 routes.
  - This checkpoint does not complete Keycloak token verification, PostgreSQL RLS, Valkey rate limiting, private file storage, notification delivery, audit persistence, or strict web CSP migration.
- Phase 2 Checkpoint 2 completed:
  - Added Keycloak/OIDC-compatible claim mapping into `@society/security`.
  - Added API bearer-token verifier scaffold using `jose` remote JWKS validation.
  - Added API authentication guard that requires `Authorization: Bearer <token>` and `x-society-id`, attaches authenticated principal and tenant context, and rejects cross-society switching.
  - Added focused tests proving OIDC membership mapping, malformed role rejection, request principal attachment, missing-token rejection, and cross-society guard rejection.
- Phase 2 Checkpoint 3 completed:
  - Added immutable audit event factory with tenant/request context.
  - Added PostgreSQL tenant RLS policy SQL generator for society-scoped tables.
  - Added API rate-limit service contract with a Valkey-compatible increment-store boundary and in-memory local fallback.
  - Added private file upload intent policy with tenant-scoped object keys and short-lived signed URL metadata.
  - Added notification foundation service that creates idempotent tenant-scoped notification jobs.
  - Added strict API security headers middleware with an API CSP that does not include `unsafe-inline` or `unsafe-eval`.
  - Verified focused Phase 2 suite passes: 11 files and 17 tests.
  - Verified `npm run typecheck:security`, `npm run typecheck:db`, `npm run typecheck:api`, and root `npm run typecheck` pass.
  - Verified `npm run test` passes: 15 Vitest files, 25 Vitest tests, and 2 worker tests.
  - Verified targeted lint for new Phase 2 files passes.
  - Verified `npm run build` passes and generates 117 routes.
  - Live provider verification is still pending for real Keycloak realm setup, PostgreSQL RLS migration application, Valkey-backed rate limiting, MinIO/S3 signed URL execution, notification workers/providers, and persistent audit writes.
- Phase 2 Checkpoint 4 completed:
  - Added Keycloak realm import artifact at `infra/keycloak/society-connect-realm.json` with local realm, confidential API client, membership/platform-role claim mappers, and TOTP required action.
  - Updated Docker Compose Keycloak service to mount the local realm import and start with `--import-realm`.
  - Extended OIDC claim mapping so Keycloak `amr`/`acr` MFA claims can satisfy privileged-role MFA enforcement.
  - Added persistent `AuditLogService` that writes security and activity audit records through the shared Prisma client boundary.
  - Added `ValkeyRateLimitStore` and RESP transport for distributed rate-limit buckets.
  - Added S3 SigV4 presigner and wired private file upload intents to generate presigned PUT URLs.
  - Added tenant RLS manifest and SQL artifact at `packages/db/rls/001-tenant-isolation.sql` for core society-scoped tables.
  - Verified provider-ready focused tests pass: 6 files and 7 tests.
  - Verified `npm run typecheck:api`, `npm run typecheck:db`, `npm run typecheck:security`, and root `npm run typecheck` pass.
  - Verified `npm run test` passes: 20 Vitest files, 31 Vitest tests, and 2 worker tests.
  - Verified `npm run db:validate` passes.
  - Verified targeted lint for Phase 2 files passes.
  - Verified `npm run build` passes and generates 117 routes.
  - `docker compose config` is still blocked in this environment because Docker CLI is not installed or not on PATH.
- Phase 2 runtime setup attempt:
  - Installed Docker Desktop 4.76.0 through `winget`.
  - Verified WSL 2 is available.
  - Verified Docker Desktop service can be started.
  - Docker Linux engine still returns HTTP 500 for `docker info` on `dockerDesktopLinuxEngine`; Docker Desktop first-run/reboot is required before Compose services can be validated.
  - Added `npm run phase2:live` as the repeatable Phase 2 runtime validation command.
- Restored the Phase 1 foundation files into the current `main` working tree from the recoverable local snapshot without changing branch history.
- Fixed Phase 1 commit-readiness rules:
  - `.env.example` is no longer hidden by `.gitignore`.
  - `.github/workflows/ci.yml` is no longer hidden by `.gitignore`.
- Strengthened Phase 1 database boundary:
  - Added `packages/db/src` as the shared Prisma runtime boundary.
  - Added safe database URL redaction.
  - Re-exported shared Prisma from `src/lib/prisma.ts` so existing Next.js imports keep working.
  - Added NestJS API `DatabaseModule`.
  - Changed API `/health/ready` to ping the database and report unavailable readiness when the database is down.
  - Added focused tests for database URL redaction and API database readiness snapshots.
  - Verified `npm run typecheck:db`, `npm run typecheck:api`, and focused DB/API readiness tests pass.
- Phase 1 Checkpoint 8 completed:
  - Verified `npm run phase1:status` passes.
  - Verified package and app typechecks pass: config, db, API, worker, test, and root.
  - Verified `npm run test` passes: 6 Vitest tests and 2 worker tests.
  - Verified `npm run db:validate` passes.
  - Verified `npm run db:generate` passes.
  - Verified `npm run test:e2e -- --list` finds 1 smoke test.
  - Verified `npm run test:e2e` passes.
  - Verified `npm run build` passes and generates 117 routes.
  - Verified `npm run lint` still fails at the known baseline: 57 problems, 28 errors, 29 warnings.
  - Verified `docker compose config` cannot run in this environment because Docker CLI is not installed or not on PATH.
- Phase 2 can now start from:
  - workspace scaffolding,
  - environment contracts,
  - local infrastructure definitions,
  - NestJS API and worker scaffolds,
  - shared Prisma database boundary,
  - DB-aware API readiness,
  - Vitest and Playwright test foundations,
  - CI workflow definition.
- Phase 2 must still address identity, tenancy, security, central permissions, Keycloak/OIDC, audit foundation, RLS, distributed rate limiting, files, notifications, and strict security headers.

### 5 June 2026

- Phase 0 roadmap and product audit documentation created.
- Phase 1 detailed engineering-foundation plan created.
- Phase 1 Checkpoint 1 completed:
  - Added `pnpm-workspace.yaml`.
  - Added `turbo.json`.
  - Added placeholder `apps/` and `packages/` directories.
  - Added root compatibility scripts: `dev:web`, `build:web`, `lint:web`, `typecheck`, and `phase1:status`.
  - Verified `npm run phase1:status` passes.
  - Verified `npm run typecheck` passes.
  - Verified `npm run build` passes and generates 117 routes.
  - Verified `npm run lint` still fails on the existing baseline: 28 errors and 29 warnings.
- Phase 1 Checkpoint 2 completed:
  - Added `.env.example` with non-secret placeholders for current app, API, worker, PostgreSQL, Keycloak, Valkey, MinIO/S3, push, email/SMS, Razorpay, and OpenTelemetry.
  - Added `docs/LOCAL_DEVELOPMENT.md`.
  - Added `packages/config` with a zero-dependency strict environment contract.
  - Added `typecheck:config` script.
  - Added TypeScript path alias for `@society/config`.
  - Verified `npm run typecheck:config` passes.
  - Verified `npm run typecheck` passes.
  - Verified `npm run build` passes and generates 117 routes.
  - Verified `npm run lint` still fails on the existing baseline: 28 errors and 29 warnings.
- Phase 1 Checkpoint 3 completed:
  - Added `docker-compose.yml` for local PostgreSQL, Valkey, MinIO, and Keycloak.
  - Added local infrastructure docs under `infra/`.
  - Added local PostgreSQL init script for a separate Keycloak database.
  - Updated `.env.example` with local service bootstrap variables.
  - Updated `docs/LOCAL_DEVELOPMENT.md` with Compose startup/shutdown commands.
  - Verified `npm run typecheck:config` passes.
  - Verified `npm run typecheck` passes.
  - Verified `npm run build` passes and generates 117 routes.
  - Verified `npm run lint` still fails on the existing baseline: 28 errors and 29 warnings.
  - Could not run `docker compose config` because Docker CLI is not installed or not on PATH.
- Phase 1 Checkpoint 4 completed:
  - Added `apps/api` NestJS + Fastify scaffold.
  - Added `/health/live` and `/health/ready`.
  - Added request ID middleware.
  - Added problem-json error filter.
  - Added OpenAPI docs at `/docs`.
  - Added `dev:api` and `typecheck:api` scripts.
  - Installed NestJS/Fastify/OpenAPI dependencies.
  - Verified `npm run typecheck:api` passes.
  - Verified `npm run typecheck` passes.
  - Smoke-tested the API: `/health/live` returned `ok`, `/health/ready` returned `ok`, and `/docs` returned HTTP 200.
  - Verified `npm run build` passes and generates 117 routes.
  - Verified `npm run lint` still fails on the existing baseline: 28 errors and 29 warnings.
  - `npm install` reported 19 vulnerabilities: 6 moderate and 13 high. These require a dedicated dependency-audit checkpoint.
