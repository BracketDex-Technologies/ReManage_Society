# Phase 5 Operations And Security Modules Implementation Plan

> **STATUS: COMPLETE (7 June 2026).** All eight checkpoints (CP1–CP8) are implemented in compatibility mode and passed the exit-gate verification: 212 Vitest tests, 5 worker tests, all operations/security/api/worker typechecks, `prisma validate`, and `next build`, with the lint baseline unchanged. The schema hardening below remains deferred to a dedicated migration checkpoint.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild society operations and gate-security workflows so visitors, guard operations, packages, domestic staff, attendance, parking, vendors, assets, facilities, amenities, bookings, incidents, blacklists, patrols, and SOS are correct, tenant-scoped, role-aware, auditable, mobile-first, and retry-safe.

**Architecture:** Follow the Phase 3/4 pattern. Start with a pure `@society/operations-core` package that owns operational invariants (state machines, validation, deterministic dedupe/idempotency keys, mobile/offline event envelopes). Expose those rules through the NestJS API with Phase 2 authentication, central permission authorization, and Phase 3 tenant context. Persistence stays behind API repositories that reuse the existing Prisma operations models (compatibility mode) until a dedicated migration checkpoint is approved.

**Tech Stack:** TypeScript, Vitest, NestJS/Fastify, Prisma, `@society/security`, `@society/db`, existing Phase 1/2/3/4 workspace scripts.

## Persistence Decision

The existing operations models (`Visitor`, `Package`, `DomesticStaff`, `StaffFlatLink`, `StaffAttendance`, `ParkingSlot`, `ParkingZone`, `Vehicle`, `ParkingAssignment`, `Facility`, `Amenity`, `AmenityPolicy`, `AmenitySchedule`, `FacilityBooking`, `FacilityWaitlist`, `AmenityUsageLog`, `AmenityPenalty`, `GateIncident`, `Blacklist`, `GuardPatrol`, `GuardUser`, `Vendor`, `SocietyAsset`) are comprehensive and logical, so Phase 5 runs in compatibility mode (option A): reuse existing models, no new migrations directory.

### Suggested schema hardening (deferred to a future migration checkpoint)

These are recommendations only; they are NOT implemented in compatibility mode. They are recorded so a later dedicated migration checkpoint can strengthen retry-safety and security:

- A generic tenant-scoped `OperationsEventLog` / idempotency table keyed by `(societyId, clientEventId)` so offline-queued guard actions replay safely across every operations workflow instead of relying on per-model natural keys.
- Visitor approval timeline rows (status transitions with actor + timestamp) instead of single mutable status fields.
- SOS escalation tree, acknowledgement, and dispatch records (current `GateIncident` only has `severity`/`status`).
- Predefined patrol routes/checkpoints so `GuardPatrol` scans can be verified against an expected route.
- First-class idempotency keys on `Visitor`, `Package`, and `StaffAttendance`.

Until then, repositories implement best-effort idempotency using deterministic natural keys (documented per workflow) and the domain layer always produces an explicit dedupe key.

## File Structure

- Create: `packages/operations-core/package.json`
- Create: `packages/operations-core/tsconfig.json`
- Create: `packages/operations-core/src/index.ts`
- Create: `packages/operations-core/src/operations-core.test.ts`
- Modify: `package.json` (add `typecheck:operations-core`)
- Modify: `tsconfig.json` (add `@society/operations-core` path)
- Modify: `packages/security/src/types.ts`
- Modify: `packages/security/src/permission-policy.ts`
- Create: `apps/api/src/operations/operations.module.ts`
- Create: `apps/api/src/operations/visitor.service.ts` (+ `.test.ts`)
- Create: `apps/api/src/operations/visitor.repository.ts` (+ `.test.ts`)
- Create: `apps/api/src/operations/visitor.controller.ts` (+ `.test.ts`)
- Create: later checkpoint files for packages, staff, parking, facilities, vendors/assets, incidents/blacklist/patrol/SOS
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/worker/src/*` (operations worker envelopes)
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`
- Modify: `docs/LOCAL_DEVELOPMENT.md`

## Permission Model (added incrementally per checkpoint)

- `operations:gate.manage` — guard gate console actions (log visitor, mark entry/exit, receive/hand over packages, mark staff attendance, scan patrol, report incident). Roles: guard, committee, society_admin, platform_admin. No MFA (mobile-first PIN guards).
- `operations:visitor.respond` — resident responds to their own visitor requests. Roles: resident, committee, society_admin, platform_admin. No MFA.
- `operations:read` — read operational data. Roles: resident, guard, committee, society_admin, platform_admin. No MFA.
- `operations:manage` — manage operational configuration and sensitive security data (blacklist, vendors, assets, facilities/amenities/parking config). Roles: committee, society_admin, platform_admin. MFA required.
- `operations:booking.manage` — create/cancel amenity bookings. Roles: resident, committee, society_admin, platform_admin. No MFA.
- `operations:sos.raise` — raise an SOS/emergency. Roles: resident, guard, committee, society_admin, platform_admin. No MFA.

## Checkpoint 1: Operations Domain Foundation + Visitors & Guard/Patrol

**Files:**
- Create: `packages/operations-core/package.json`, `tsconfig.json`, `src/index.ts`, `src/operations-core.test.ts`
- Modify: `package.json`, `tsconfig.json`
- Modify: `packages/security/src/types.ts`, `packages/security/src/permission-policy.ts`
- Create: `apps/api/src/operations/visitor.service.ts` (+test), `visitor.repository.ts` (+test), `visitor.controller.ts` (+test), `operations.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing operations-core tests**

Test the visitor lifecycle state machine (`applyVisitorTransition`), walk-in vs pre-approved logging (`planVisitorLog`), deterministic dedupe keys (`visitorLogDedupeKey`, `patrolScanDedupeKey`), passcode generation (`generateVisitorPasscode`), and offline guard action envelopes (`buildGuardActionEnvelope`).

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run packages/operations-core/src/operations-core.test.ts` (fails: package missing).

- [ ] **Step 3: Implement operations-core package**

Pure functions, no side effects. Reject illegal transitions, missing identifiers, empty checkpoints, and non-positive timestamps.

- [ ] **Step 4: GREEN + typecheck**

Run focused vitest and `npm run typecheck:operations-core`.

- [ ] **Step 5: Permissions**

Add the Phase 5 permission actions above to `types.ts` and `permission-policy.ts`, with MFA only on `operations:manage`. Extend `permission-policy.test.ts`.

- [ ] **Step 6: API slice (visitors + patrol)**

`VisitorService` authorizes via `SecurityPolicyService`; `VisitorRepository` is a fake-client-testable Prisma boundary over `Visitor` + `GuardPatrol`; `VisitorController` exposes tenant-protected routes under `/api/v1/operations`. Register `OperationsModule` in `app.module.ts`.

Routes:
```text
POST /api/v1/operations/visitors/log
POST /api/v1/operations/visitors/respond
POST /api/v1/operations/visitors/transition
POST /api/v1/operations/visitors/list
POST /api/v1/operations/patrol/scan
POST /api/v1/operations/patrol/list
```

- [ ] **Step 7: Verify CP1**

Run `npm run typecheck:operations-core`, `npm run typecheck:security`, `npm run typecheck:api`, root `npm run typecheck`, `npm run test`, `npm run db:validate`, `npm run build`, and record the `npm run lint` baseline without hiding it.

## Checkpoint 2: Packages

Package receive → notify → handover with OTP verification and resident confirmation. Deterministic dedupe key, idempotent handover, notification job envelope. Routes under `/api/v1/operations/packages`.

## Checkpoint 3: Domestic Staff & Attendance

Staff registration, flat links, and guard-marked attendance (check-in/check-out) with idempotent attendance and code/manual methods. Routes under `/api/v1/operations/staff`.

## Checkpoint 4: Parking

Zones, slots, vehicle assignment, capacity/enforcement validation, and visitor parking. Routes under `/api/v1/operations/parking`.

## Checkpoint 5: Facilities, Amenities & Bookings

Amenity policy validation (booking window, max hours, cooldown, cancellation cutoff, blackout schedules), capacity, waitlist transitions, and paid-booking amount calculation. Routes under `/api/v1/operations/amenities`.

## Checkpoint 6: Vendors & Assets

Vendor contracts/AMC schedules, asset register, warranty/maintenance-cycle reminders (worker envelopes). Routes under `/api/v1/operations/vendors` and `/api/v1/operations/assets`.

## Checkpoint 7: Incidents, Blacklist, Patrol Verification & SOS

Gate incidents, blacklist add/check with gate warnings, SOS raise + escalation/severity, and notification fan-out. Routes under `/api/v1/operations/incidents`, `/blacklist`, `/sos`. Add operations worker envelopes (`apps/worker/src/operations-worker.ts`) for reminders and SOS escalation, deterministic IDs, retry-safe.

## Checkpoint 8: Phase 5 Exit Gate

Confirm role, mobile (offline replay/idempotency), audit, notification, and failure-retry coverage across all operations workflows. Run full verification suite and update both docs.

## Verification Commands

```powershell
npm run typecheck:operations-core
npm run typecheck:security
npm run typecheck:api
npm run typecheck:worker
npm run typecheck
npm run test
npm run db:validate
npm run db:generate
npm run build
npm run lint
```
