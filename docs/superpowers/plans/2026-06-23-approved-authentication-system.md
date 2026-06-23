# Approved Authentication System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current mixed local/OIDC authentication with one password-based, society-scoped authentication system that follows `re-auth-sys.md`.

**Architecture:** `User` remains the global identity and password-hash record. A new `SocietyMembership` becomes the authoritative record for a user's single active society, product role, internal permission role, and lifecycle status; the legacy `User.societyId`/`role` fields remain synchronized during this rollout so existing domain routes do not break. All session claims are loaded from an active membership, then the shared security package evaluates the corresponding society-scoped role.

**Tech Stack:** Next.js 16 route handlers and React 19, Prisma/PostgreSQL, `bcryptjs`, `jose`, Vitest, existing `@society/security` permissions.

**Rollback baseline:** The pre-migration authentication system is the clean `main` commit `758fb75` (`docs: define society authentication system`). Auth changes in this rollout will stay limited to the files named below, so a targeted rollback can restore those files from that commit without discarding unrelated workspace work.

---

## Impacted file structure

- Create: `src/lib/membership.ts` — membership role/status constants, mappings, and transactional lookup helpers.
- Create: `src/lib/membership.test.ts` — role mapping, activation, and cross-society contract tests.
- Create: `prisma/migrations/<timestamp>_society_membership_auth/migration.sql` — additive schema, deterministic legacy-user backfill, constraints, and indexes.
- Modify: `prisma/schema.prisma` — `User.isActive`, `SocietyMembership`, and required relations/indexes.
- Modify: `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/auth-request.ts` — membership-aware session creation and validation.
- Modify: `src/app/api/auth/{login,logout,register,join,me}/route.ts` — one local-password flow and lifecycle-correct onboarding.
- Create: `src/app/api/memberships/[id]/approve/route.ts` — Chairman/Secretary approval endpoint for pending resident claims.
- Modify: `src/app/api/credentials/route.ts`, `src/app/(dashboard)/credentials/page.tsx` — Chairman-only staff creation and membership-aware account management.
- Modify: `packages/security/src/{types,bff-bridge-token,permission-policy,legacy-route-policy,legacy-module-policy}.ts` — use membership permission roles without MFA gates.
- Modify or delete: `src/lib/keycloak-config.ts`, `src/app/api/auth/callback/route.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/LoginForm.tsx`, OIDC-only test/config/docs references — remove authentication-only external identity path.
- Test: focused Vitest tests for the new membership service, auth routes, authorization policy, and auth UI; then full typecheck, Prisma validation, and unit suite.

### Task 1: Lock the membership contract before changing persistence

**Files:**
- Create: `src/lib/membership.ts`
- Create: `src/lib/membership.test.ts`
- Modify: `packages/security/src/types.ts`
- Modify: `packages/security/src/bff-bridge-token.ts`
- Test: `src/lib/membership.test.ts`, `packages/security/src/permission-policy.test.ts`

- [ ] **Step 1: Write failing tests for the approved product-role to permission-role mapping.**
  - Chairman -> `society_admin`; Secretary -> `committee`; Treasurer -> `treasurer`; Guard -> `guard`; owner/member -> `member`; Tenant -> `tenant`.
  - Assert invalid or browser-supplied privileged roles are rejected.
- [ ] **Step 2: Run the focused test and confirm the failure is due to the absent membership contract.**
- [ ] **Step 3: Implement typed membership constants, status values (`pending`, `active`, `rejected`), mappings, and a single active-membership resolver.**
- [ ] **Step 4: Update `@society/security` types and bridge conversion to accept the new internal role names. Remove `mfaVerified` from the local membership contract.**
- [ ] **Step 5: Re-run focused tests and refactor only after green.**

### Task 2: Add schema support and migrate existing users safely

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_society_membership_auth/migration.sql`
- Modify: `src/lib/membership.ts`
- Test: `src/lib/membership.test.ts`

- [ ] **Step 1: Write failing tests that describe an active membership lookup and a pending membership being unable to form a full session.**
- [ ] **Step 2: Run them to establish the red state.**
- [ ] **Step 3: Add `User.isActive` and `SocietyMembership` (`userId`, `societyId`, product role, permission role, status, optional flat/person linkage, timestamps) with unique user/society and access indexes.**
- [ ] **Step 4: Write an additive migration that backfills each legacy user with a non-null `societyId` into an active membership using the legacy role mapping. Preserve `User.societyId` and `User.role` for the compatibility period; do not infer memberships for orphaned users.**
- [ ] **Step 5: Generate Prisma client, run `npm run db:validate`, and rerun the membership suite.**

### Task 3: Make local password sessions membership-derived and remove alternate auth

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/lib/auth-request.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/api/auth/me/route.ts`
- Modify: `src/proxy.ts`
- Modify/Delete: Keycloak/OIDC route and UI files listed above
- Test: new auth-route tests; `src/app/(auth)/auth-control-contract.test.ts`; security policy tests

- [ ] **Step 1: Add failing route/service tests for inactive users, no active membership, valid password login, session claims sourced from membership, and logout revocation.**
- [ ] **Step 2: Run the test subset and confirm each expected red failure.**
- [ ] **Step 3: Implement one local email/password login path: normalize email, rate-limit, verify hash, require `User.isActive`, resolve the active membership, and mint only the membership's society/role claims.**
- [ ] **Step 4: Remove Keycloak/OIDC callback/login/logout behavior and the login-page branch. Keep non-auth domain OTP flows (such as package pickup) unchanged.**
- [ ] **Step 5: Remove MFA enforcement from permission evaluation and update its tests so authorized society roles can act without MFA. Keep tenant-scope checks intact.**
- [ ] **Step 6: Rerun focused auth/security tests and inspect API responses for unchanged client-compatible fields where required.**

### Task 4: Implement the three approved provisioning workflows

**Files:**
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/auth/join/route.ts`
- Modify: `src/app/api/credentials/route.ts`
- Create: `src/app/api/memberships/[id]/approve/route.ts`
- Modify: `src/app/api/societies/join-code/route.ts` if regeneration is not currently Chairman-scoped
- Test: route tests for registration, staff provisioning, resident join, and approval

- [ ] **Step 1: Write failing tests for atomic Chairman registration: new User + Society + active Chairman membership; duplicate email and duplicate society creation are rejected.**
- [ ] **Step 2: Implement the transaction, server-generated join code, and immediate active session. Do not accept society assignment or privileged role from the browser.**
- [ ] **Step 3: Write failing tests proving only an active Chairman can create Secretary, Treasurer, or Guard accounts and that the new account inherits the Chairman's society.**
- [ ] **Step 4: Implement Chairman-only staff provisioning and replace credential auto-generation as the privileged-account path.**
- [ ] **Step 5: Write failing tests for resident join: valid join code creates only a pending membership and pending occupancy claim; an invalid join code, cross-society flat, or occupied owner/tenant claim is rejected.**
- [ ] **Step 6: Implement resident onboarding and a society-scoped Chairman/Secretary approval route that activates final `member` or `tenant` access only after validating the flat claim.**
- [ ] **Step 7: Run route tests for all three flows, including rollback behavior from an injected transaction failure.**

### Task 5: Migrate the management UI and remove obsolete configuration

**Files:**
- Modify: `src/app/(dashboard)/credentials/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/(auth)/join/page.tsx`
- Modify: `src/lib/role-access.ts`, `src/lib/rbac.ts`, `src/lib/roles.ts`
- Modify: `.env.example`, `packages/config/src/env.ts`, associated configuration tests, and relevant local/deployment docs
- Test: UI contracts, role-access tests, config tests

- [ ] **Step 1: Write failing UI/API contracts for staff roles, pending resident visibility, and no Keycloak sign-in control.**
- [ ] **Step 2: Update the credentials page to use the new staff-provision endpoint and clearly separate pending resident approvals from active users.**
- [ ] **Step 3: Update registration and join copy/states for immediate Chairman access versus pending resident access.**
- [ ] **Step 4: Remove authentication-only Keycloak environment rules and docs. Do not remove unrelated delivery/pickup OTP configuration or behavior.**
- [ ] **Step 5: Run focused UI/config/security tests, then `npm run typecheck`, `npm run db:validate`, and `npm run test:unit`.**

### Task 6: Final acceptance verification

**Files:**
- Modify only files identified by failed verification.

- [ ] **Step 1: Verify all approved rules against tests: unique email, one active society per user, Chairman bootstrap, server-assigned staff society, pending resident access, flat validation, and cross-society denial.**
- [ ] **Step 2: Run `npm run lint`, `npm run typecheck`, `npm run db:validate`, and `npm run test:unit`.**
- [ ] **Step 3: Run `npm run build` after the test suite is clean.**
- [ ] **Step 4: Inspect `git diff --check` and `git status --short`; report all changed files and any intentionally deferred infrastructure removal.**
