# Phase 6 Community And Governance Implementation Plan

> **STATUS: COMPLETE (7 June 2026).** All eight checkpoints (CP1–CP8) are implemented in compatibility mode and passed the exit-gate verification: 336 Vitest tests, 8 worker tests, all community-core/security/api/worker typechecks, `prisma validate`, and `next build` (117 routes), with the lint baseline unchanged (57 problems / 28 errors / 29 warnings, zero new). Scope decisions honored: directory treated as done (Phase 3) with search/filter polish deferred to Phase 7; legal-adviser redesigned as non-advisory document/checklist templates; forum AND marketplace both shipped with moderation/retention; reminders and smart nudges ship as deterministic retry-safe worker envelopes (no real transport yet). Schema hardening remains deferred to a dedicated migration checkpoint.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild society communication and governance workflows so notices, helpdesk, documents, meetings, polls, events, forum, marketplace, reminders, and smart nudges are correct, tenant-scoped, role-aware, auditable, moderated where needed, and have clear ownership, permissions, and retention behavior.

**Architecture:** Follow the Phase 3/4/5 pattern. Start with a pure `@society/community-core` package that owns community/governance invariants (state machines, validation, voting/RSVP integrity, deterministic dedupe/idempotency keys, retention rules, reminder/nudge envelopes). Expose those rules through the NestJS API with Phase 2 authentication, central permission authorization, and Phase 3 tenant context. Persistence stays behind API repositories that reuse the existing Prisma community/governance models (compatibility mode) until a dedicated migration checkpoint is approved.

**Tech Stack:** TypeScript, Vitest, NestJS/Fastify, Prisma, `@society/security`, `@society/db`, existing Phase 1–5 workspace scripts. Worker envelopes use `node:test`.

## Persistence Decision

The existing community/governance models (`Notice`, `NoticeRead`, `Complaint`, `Document`, `MeetingMinutes`, `Poll`, `SocietyEvent`, `EventRsvp`, `ForumThread`, `ForumReply`, `MarketplaceListing`, `MarketplaceCategory`, `MarketplaceImage`, `MarketplaceInterest`, `MarketplaceTransaction`, `MarketplaceModeration`, `ReminderLog`) are comprehensive, so Phase 6 runs in compatibility mode (option A): reuse existing models, no new migrations directory.

### Suggested schema hardening (deferred to a future migration checkpoint)

These are recommendations only; they are NOT implemented in compatibility mode:

- A generic tenant-scoped idempotency/event-log table keyed by `(societyId, clientEventId)` so reminder/nudge dispatch and resident actions replay safely instead of relying on per-model natural keys.
- Status enums for `Complaint.status`/`priority`, `Poll.status`, `SocietyEvent.status`, `MarketplaceListing.status`/`moderationStatus` instead of free-text strings.
- A first-class `Document` scope column (`society` | `flat` | `personal`) plus owner/flat references and a version chain, instead of inferring scope from `category` + uploader.
- A poll-vote table (one row per voter+option) instead of JSON `votes`/`voters` blobs, to make single-vote enforcement and auditing first-class.
- Complaint status-transition timeline rows (actor + timestamp) instead of single mutable status fields.
- `@@unique([eventId, userId])` already exists on `EventRsvp`; add equivalent natural-key uniqueness for `NoticeRead` `(noticeId, userId)`.

Until then, repositories implement best-effort idempotency using deterministic natural keys (documented per workflow) and the domain layer always produces an explicit dedupe key.

## File Structure

- Create: `packages/community-core/package.json`, `tsconfig.json`, `src/index.ts`, `src/community-core.test.ts`
- Modify: `package.json` (add `typecheck:community-core`)
- Modify: `tsconfig.json` (add `@society/community-core` path)
- Modify: `packages/security/src/types.ts`, `packages/security/src/permission-policy.ts` (+ `permission-policy.test.ts`)
- Create per checkpoint under `apps/api/src/community/`: `notice.*`, `helpdesk.*`, `document.*`, `meeting.*`, `poll.*`, `event.*`, `forum.*`, `marketplace.*` (service/repository/controller + tests), and `community.module.ts`
- Modify: `apps/api/src/app.module.ts` (register `CommunityModule`)
- Create: `apps/worker/src/community-worker.ts` (+ `.test.ts`)
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`, `docs/LOCAL_DEVELOPMENT.md`

## Permission Model (added incrementally per checkpoint)

- `community:read` — read community/governance data (notices, documents, meetings, polls, events, forum, marketplace). Roles: resident, guard (notices only via read), treasurer, committee, society_admin, platform_admin. No MFA.
- `community:notice.manage` — publish/pin/expire notices. Roles: committee, society_admin, platform_admin. No MFA.
- `community:helpdesk.respond` — raise complaints and rate resolution (own complaints). Roles: resident, committee, society_admin, platform_admin. No MFA.
- `community:helpdesk.manage` — assign, set SLA, escalate, resolve complaints. Roles: committee, society_admin, platform_admin. No MFA (operational desk work).
- `community:document.manage` — upload/manage society-scoped documents. Roles: committee, society_admin, platform_admin. MFA required (sensitive governance documents).
- `community:governance.manage` — manage meetings, polls, events (create/close/record). Roles: committee, society_admin, platform_admin. MFA required.
- `community:vote.cast` — cast a poll vote. Roles: resident, committee, society_admin, platform_admin. No MFA.
- `community:rsvp.manage` — RSVP to events. Roles: resident, committee, society_admin, platform_admin. No MFA.
- `community:post` — create forum threads/replies and marketplace listings/interests. Roles: resident, committee, society_admin, platform_admin. No MFA.
- `community:moderate` — moderate forum/marketplace (pin/lock/approve/reject/report/archive). Roles: committee, society_admin, platform_admin. No MFA (active community moderation).

## Checkpoint 1: Community Domain Foundation + Notices + Permissions

**Files:** create `packages/community-core/*`; modify `package.json`, `tsconfig.json`, `packages/security/src/types.ts`, `packages/security/src/permission-policy.ts` (+test); create `apps/api/src/community/notice.service.ts` (+test), `notice.repository.ts` (+test), `notice.controller.ts` (+test), `community.module.ts`; modify `apps/api/src/app.module.ts`.

- [x] **Step 1: Write failing community-core tests** — notice publish planning (`planNotice`: required title/body, category normalization, pin flag, optional expiry), notice retention (`isNoticeActive`, `isNoticeExpired`), read-receipt dedupe (`noticeReadDedupeKey`), and a generic community action envelope (`buildCommunityEventEnvelope`).
- [x] **Step 2: Confirm RED** — `npx vitest run packages/community-core/src/community-core.test.ts` (failed: package missing).
- [x] **Step 3: Implement community-core package** — pure functions, no side effects. Reject empty identifiers and invalid dates.
- [x] **Step 4: GREEN + typecheck** — focused vitest (13 tests) + `npm run typecheck:community-core` pass.
- [x] **Step 5: Permissions** — added Phase 6 actions to `types.ts` and `permission-policy.ts` (MFA only on `community:document.manage` and `community:governance.manage`); extended `permission-policy.test.ts` (9 tests).
- [x] **Step 6: API slice (notices)** — `NoticeService` authorizes via `SecurityPolicyService`; `NoticeRepository` is a fake-client-testable Prisma boundary over `Notice` + `NoticeRead` with idempotent read-receipt replay; `NoticeController` exposes tenant-protected routes under `/api/v1/community`. Registered `CommunityModule` in `app.module.ts`.

```text
POST /api/v1/community/notices/create
POST /api/v1/community/notices/list
POST /api/v1/community/notices/mark-read
POST /api/v1/community/notices/read-receipts
```

- [x] **Step 7: Verify CP1** — `npm run typecheck:community-core`, `:security`, `:api`, root `npm run typecheck`, `npm run test` (239 Vitest + 5 worker), `npm run db:validate`, `npm run build` (117 routes) all pass; `npm run lint` unchanged at baseline (57 problems / 28 errors / 29 warnings, zero new from Phase 6).

## Checkpoint 2: Helpdesk (Complaints)

Complaint lifecycle state machine (`open → in_progress → resolved → closed`, reopen rules), SLA hours and breach computation, assignment, escalation tiers (0=none → 1=secretary → 2=chairman), media URL attachments, satisfaction rating capture, and audit. Reuses `Complaint`. Routes under `/api/v1/community/helpdesk`.

## Checkpoint 3: Documents

Society/flat/personal scope resolution and visibility filtering, category permissions, private-storage upload intent (reuse Phase 2 `FileStoragePolicyService`), best-effort versioning (supersede prior version by title+scope), and retention rules. Reuses `Document`. Routes under `/api/v1/community/documents`.

## Checkpoint 4: Governance — Meetings + Polls

Meeting agenda/attendance/resolutions recording and export shaping (reuse `MeetingMinutes`). Poll creation with options, voting controls (single vote per flat via `voters` dedupe, reject votes after close, reject unknown option index), tally integrity, and close transition (reuse `Poll`). Routes under `/api/v1/community/meetings` and `/api/v1/community/polls`.

## Checkpoint 5: Events

Event lifecycle (`upcoming → ongoing → completed`/`cancelled`), RSVP capacity enforcement against `maxAttendees`, deterministic RSVP dedupe (natural key `(eventId, userId)`), and RSVP response update. Reuses `SocietyEvent`, `EventRsvp`. Routes under `/api/v1/community/events`.

## Checkpoint 6: Community — Forum + Marketplace

Forum threads/replies with pin/lock controls, moderation, and `lastActivityAt` maintenance (reuse `ForumThread`, `ForumReply`). Marketplace listings with `moderationStatus` workflow (pending/approved/rejected/reported/archived), interest expressions, privacy status filtering, image references, and retention/expiry (reuse `MarketplaceListing`, `MarketplaceImage`, `MarketplaceInterest`, `MarketplaceModeration`). Routes under `/api/v1/community/forum` and `/api/v1/community/marketplace`.

## Checkpoint 7: Reminders, Smart Nudges + Legal-Adviser Disposition

Deterministic, retry-safe worker envelopes in `apps/worker/src/community-worker.ts` (`buildCommunityWorkerJob`) for notice expiry reminders, upcoming meeting/event reminders, and smart nudges (e.g. unread-notice nudge, poll-closing-soon nudge, expiring-document nudge). Deterministic IDs, capped attempts, idempotent on replay — no real transport (deferred hardening). Resolve the legal-adviser quality gate by redesigning it as non-advisory document/checklist templates routed through the Documents module (template catalog with an explicit "not legal advice" disclaimer), not as live advice.

## Checkpoint 8: Phase 6 Exit Gate

Confirm ownership, moderation, permissions, and retention coverage across all community/governance workflows (role, idempotency/replay, audit, notification/nudge, retention tests). Run full verification suite and update `docs/PRODUCT_PRODUCTION_ROADMAP.md` (progress log + immediate next step) and `docs/LOCAL_DEVELOPMENT.md`.

## Verification Commands

```powershell
npm run typecheck:community-core
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
