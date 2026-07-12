# Registered Society Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an additive `/registered-society` portal-owner dashboard without changing existing society registration or society-user login behavior.

**Architecture:** Add a separate `PortalAdmin` model and `portal_session` cookie. Implement protected portal APIs for login, bootstrap registration, partner creation, registered society summaries, and chairman temporary password reset. Build a client page that switches between login/bootstrap and the dashboard.

**Tech Stack:** Next.js App Router, React client components, Prisma, PostgreSQL, bcryptjs, jose JWT sessions, Vitest.

## Global Constraints

- Existing `/register` behavior remains unchanged.
- Existing `/login` and society sessions remain unchanged.
- Portal admins are separate from society users.
- Chairman passwords are never stored in plaintext.
- New temporary chairman passwords are shown only once after reset.

---

### Task 1: Portal Helpers and Tests

**Files:**
- Create: `src/lib/portal-admin.ts`
- Test: `src/lib/portal-admin.test.ts`

**Interfaces:**
- Produces: `generateTemporaryPassword(length?: number): string`
- Produces: `calculateSocietyPortalStats(input): SocietyPortalStats`

- [ ] Write failing tests for generated password length/content and society collection calculations.
- [ ] Implement helpers.
- [ ] Run `npm run test:unit -- src/lib/portal-admin.test.ts`.

### Task 2: Data Model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260712000100_portal_admin/migration.sql`

**Interfaces:**
- Produces Prisma model `PortalAdmin`.

- [ ] Add `PortalAdmin` model with `id`, `name`, `email`, `password`, `role`, `isActive`, timestamps.
- [ ] Add SQL migration for the table and unique email index.
- [ ] Run `npx prisma validate`.

### Task 3: Portal Auth APIs

**Files:**
- Create: `src/lib/portal-auth.ts`
- Create: `src/app/api/portal/auth/status/route.ts`
- Create: `src/app/api/portal/auth/register/route.ts`
- Create: `src/app/api/portal/auth/login/route.ts`
- Create: `src/app/api/portal/auth/logout/route.ts`
- Create: `src/app/api/portal/admins/route.ts`

**Interfaces:**
- Produces: `getPortalSession()`, `requirePortalSession()`, `createPortalSession()`, `deletePortalSession()`.

- [ ] Implement separate portal session cookie.
- [ ] Add first-admin registration when no `PortalAdmin` exists.
- [ ] Add login/logout.
- [ ] Add protected partner creation.

### Task 4: Registered Society APIs

**Files:**
- Create: `src/app/api/portal/registered-societies/route.ts`
- Create: `src/app/api/portal/societies/[societyId]/chairman-password/route.ts`

**Interfaces:**
- Consumes: portal auth helpers and portal stat helpers.

- [ ] Return all societies with chairman and financial summaries.
- [ ] Reset chairman password to a generated temporary password.

### Task 5: Dashboard UI

**Files:**
- Create: `src/app/registered-society/page.tsx`

**Interfaces:**
- Consumes all portal APIs.

- [ ] Show first-admin registration or login if unauthenticated.
- [ ] Show dashboard cards, society table, partner creation form, and reset password action if authenticated.
- [ ] Keep the UI self-contained and do not modify existing dashboard navigation.

### Task 6: Verification

**Files:**
- All changed files.

- [ ] Run `npm run test:unit -- src/lib/portal-admin.test.ts`.
- [ ] Run `npx prisma validate`.
- [ ] Run `npm run typecheck`.

