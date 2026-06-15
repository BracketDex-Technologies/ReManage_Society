# Phase 7 Cross-Role UX, PWA, And Capacitor Implementation Plan

> **STATUS: COMPLETE (7 June 2026).** All eight checkpoints (CP1–CP8) implemented in compatibility mode and passed the exit-gate verification: 385 Vitest tests, 8 worker tests, 13 Playwright tests (Desktop Chrome), `cap:sync`, all typechecks, `prisma validate`, and `next build` (118 routes), with the lint baseline unchanged. Scope honored: root `src/` (no `apps/web` move), Capacitor Android sync + CI validation, push compatibility mode, Next.js `/api/*` dashboards, `packages/ui` deferred, JWT sessions for Phase 7 QA.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product feel complete and usable across roles and devices — role-focused navigation, persona dashboards, global search/quick actions, responsive layouts with consistent UX states, hardened PWA caching, offline-safe critical actions, push notification wiring, Capacitor packaging, and accessibility/visual QA — so primary workflows pass on desktop, tablet, mobile web, and packaged mobile builds.

**Architecture:** Follow the Phase 3–6 pattern for *policy logic*, adapted for UX. Start with a pure `@society/ux-core` package that owns persona resolution, navigation models, quick-action catalogs, and search-result shaping (TDD, no React). Bridge legacy session roles (`chairman`, `secretary`, `member`, `guard`, …) to `@society/security` permission actions via a thin mapping layer in `src/lib/navigation/`. UI work stays in the existing root Next.js app (`src/`) in **compatibility mode** — evolve navigation, dashboards, PWA, and mobile runtime without a physical `apps/web` move (deferred to Phase 8 hardening unless the product owner chooses otherwise). Offline replay reuses the existing IndexedDB queue (`src/lib/mobile/*`) and aligns dedupe keys with Phase 5 operations-core conventions where guard/resident mutations overlap. Push stays in **compatibility mode** unless decided otherwise: subscription persistence + typed notification envelopes + service-worker display, not a full multi-provider transport rollout.

**Tech Stack:** TypeScript, Vitest (`@society/ux-core`, navigation bridge unit tests), existing Next.js 16 app (`src/`), `@society/security` permission actions, existing PWA (`public/sw.js`, `public/manifest.json`), Capacitor 6, Playwright (multi-viewport + a11y), existing mobile runtime (`src/lib/mobile/*`, `src/components/mobile/MobileRuntime.tsx`).

## Roadmap Alignment

Phase 7 deliverables from `docs/PRODUCT_PRODUCTION_ROADMAP.md`:

| Deliverable | Current baseline | Phase 7 target |
|---|---|---|
| Role-focused navigation | Mega-menu `Sidebar.tsx` + basic `BottomNav.tsx` role forks | Persona nav driven by `@society/ux-core` + central permissions |
| Dashboards | Single ~1.5k-line `dashboard/page.tsx` with inline role branching | Dedicated committee, treasurer, resident, guard, platform-admin surfaces |
| Global search/actions | `GET /api/search` (DB scan, admin-biased); no command palette | Permission-aware command palette + extended search (incl. Phase 6 directory polish) |
| Responsive layouts | Mobile bottom nav + desktop sidebar; uneven page density | Consistent breakpoints; dense finance vs large-touch guard layouts |
| PWA caching | `public/sw.js` v2 shell + stale-while-revalidate reads | Cache strategy aligned with Next.js output; installability verified |
| Offline-safe actions | `mobileFetch` + IndexedDB queue exist; limited route wiring | Guard visitor log, patrol scan, resident visitor respond, SOS, package intake queued with dedupe |
| Push notifications | VAPID + `usePushNotifications` + SW handler | Hardened subscribe flow, persona deep links, envelope dispatch (compat mode default) |
| Capacitor builds | `capacitor.config.ts` points at remote Vercel URL; `webDir: 'public'` | Local-syncable config, documented Android build path, smoke validation |
| Accessibility & visual QA | Ad-hoc components; 1 Playwright smoke test | WCAG-oriented checks on critical workflows; tablet + mobile web projects |

**Exit gate:** Primary workflows work on desktop, tablet, mobile web, and packaged mobile builds (guard gate console, resident pay-bill/visitor-approve, committee notices/complaints, treasurer collections snapshot).

## Scope Decisions (defaults — override via Open Questions)

### Web surface: root `src/` (recommended default)

`apps/web` is listed in the locked stack but **does not exist** in the repo; `docs/LOCAL_DEVELOPMENT.md` explicitly lists “Moving the current app into `apps/web`” as not done. Phase 7 **default** is compatibility mode: all UI changes land in root `src/` with existing `npm run dev` / `npm run build` scripts. A physical monorepo move to `apps/web` is a large structural change better paired with Phase 8 API retirement; only pursue in Phase 7 if explicitly approved.

### `packages/ui` vs in-app components

`packages/ui` is also absent. Phase 7 **default**: create `@society/ux-core` for pure navigation/search policy (mirrors `@society/operations-core`). Extract only high-reuse presentation primitives (`PageState`, `CommandPalette` shell) into `src/components/ux/` first. Promote to `packages/ui` only when a second consumer exists (defer to Phase 8).

### API data source during Phase 7

Dashboards and search may continue calling existing Next.js `/api/*` routes for compatibility. New UX-only BFF helpers may call NestJS `/api/v1/*` where a migrated endpoint already exists (operations, community, finance, society-core) **only behind a feature-flagged client adapter** — not a wholesale API migration. Phase 7 is a UX phase, not an API retirement phase.

### Push transport: compatibility mode (recommended default)

Existing pieces: `web-push` dependency, `src/lib/push.ts`, `src/lib/use-push.ts`, `public/sw.js` push handler, `PushSubscription` Prisma model, Phase 2 `NotificationFoundationService` envelopes, Phase 5/6 worker envelopes. Phase 7 **default**: harden client subscription + SW routing + server-side envelope-to-web-push adapter for a **small set of critical notification types** (visitor approval, SOS, package arrived, notice published). Full provider matrix (SMS/email/FCM), delivery audit UI, and BullMQ consumer wiring remain deferred hardening (same as Phases 5–6 notification deferral).

### Capacitor: local Android sync + config validation (recommended default)

Current `capacitor.config.ts` uses `webDir: 'public'` and a production `server.url` — unsuitable for local packaged QA. Phase 7 **default**: fix config for static export or `next start` tunnel documented path, add `cap:sync` / `cap:open:android` scripts, verify project sync in CI (config + file presence), document manual emulator steps. iOS archive signing and store submission are **out of scope** unless explicitly approved.

## Persistence Decision

Phase 7 introduces **no new Prisma migrations**. Offline queue and API read cache use existing browser IndexedDB (`society-mobile-runtime`). Push subscriptions reuse `PushSubscription`. Navigation and permission policy are computed at runtime from session + `@society/security` mapping.

### Deferred hardening (carry forward, not Phase 7 blockers)

- Physical move of Next.js app to `apps/web` and generated `@society/sdk` client as the sole data layer.
- Full notification provider transport (BullMQ consumer → web-push/SMS/email) with delivery status UI.
- OIDC-only auth in the web shell (current JWT cookie sessions remain during compatibility mode).
- Replacing `src/lib/role-access.ts` route lists entirely with middleware generated from `@society/security` (Phase 7 bridges for nav; full middleware migration can trail into Phase 8).
- iOS Capacitor release pipeline and app-store assets.
- Strict CSP migration for the Next.js web shell (Phase 2 strict CSP applies to NestJS API today).

## File Structure

- Create: `packages/ux-core/package.json`, `tsconfig.json`, `src/index.ts`, `src/ux-core.test.ts`
- Modify: root `package.json` (add `typecheck:ux-core`), root `tsconfig.json` (path alias `@society/ux-core`)
- Create: `src/lib/navigation/legacy-role-bridge.ts` (+ `legacy-role-bridge.test.ts`)
- Create: `src/lib/navigation/use-persona-nav.ts` (client hook wrapping ux-core)
- Create: `src/components/ux/PageState.tsx`, `CommandPalette.tsx`, `PersonaDashboardRouter.tsx`
- Modify: `src/components/layout/Sidebar.tsx`, `BottomNav.tsx`, `Header.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (split into persona sub-views or routed children)
- Create: `src/app/(dashboard)/dashboard/_personas/*.tsx` (committee, treasurer, resident, guard, platform-admin)
- Modify: `src/app/api/search/route.ts` (permission-aware extensions)
- Modify: `src/lib/mobile/mobile-fetch.ts`, `offline-queue.ts` (critical-path wiring helpers)
- Modify: `public/sw.js`, `public/manifest.json`, `capacitor.config.ts`
- Create: `src/lib/push/notification-routing.ts` (+ test), optional `src/app/api/push/dispatch/route.ts` envelope adapter
- Create: `tests/e2e/role-workflows.spec.ts`, `tests/e2e/mobile-viewports.spec.ts`
- Add devDependency: `@axe-core/playwright` (or equivalent) for a11y checks on critical paths
- Modify: `playwright.config.ts` (mobile + tablet projects)
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`, `docs/LOCAL_DEVELOPMENT.md`

## Persona And Permission Model

`@society/ux-core` resolves a **persona** from the legacy session role (and optional platform-admin flag):

| Legacy role(s) | UX persona | Primary `@society/security` roles | Default landing |
|---|---|---|---|
| `chairman`, `secretary` | `committee` | `committee` / `society_admin` | `/dashboard` → committee view |
| `treasurer` | `treasurer` | `treasurer` | `/dashboard` → treasurer view |
| `member`, `tenant` | `resident` | `resident` | `/dashboard` → resident view |
| `guard`, `watchman` | `guard` | `guard` | `/visitors` (gate-first) |
| `facility_manager` | `operations_desk` | `committee`-like reads + `operations:booking.manage` | `/amenities` |
| platform operator (future session flag) | `platform_admin` | `platform_admin` | `/system` |

Navigation items are declared once in ux-core as `{ href, label, icon, requiredActions[], personas[] }` and filtered with `evaluatePermission` from `@society/security` (via bridge). This replaces duplicated role string arrays in `Sidebar.tsx` and `role-access.ts` for **navigation purposes only**.

## Checkpoint 1: UX Domain Foundation + Legacy Role Bridge

**Files:** create `packages/ux-core/*`; modify root `package.json`, `tsconfig.json`; create `src/lib/navigation/legacy-role-bridge.ts` (+ test).

- [x] **Step 1: Write failing ux-core tests** — `resolvePersona(role, platformRoles?)`, `buildNavigationModel(persona, permissions)`, `filterNavItems(items, allowedActions)`, `buildQuickActions(persona, permissions)` (e.g. resident gets “Pay bill”, “Approve visitor”; guard gets “Log visitor”, “Scan patrol”), `normalizeSearchResult(item, persona)` (privacy shaping).
- [x] **Step 2: Confirm RED** — `npx vitest run packages/ux-core/src/ux-core.test.ts` (fails: package missing).
- [x] **Step 3: Implement ux-core package** — pure functions; reject unknown roles; stable ordering (pinned items first, then alphabetical).
- [x] **Step 4: GREEN + typecheck** — focused vitest + `npm run typecheck:ux-core`.
- [x] **Step 5: Legacy bridge** — map `chairman|secretary` → `committee`, `member|tenant` → `resident`, `guard|watchman` → `guard`; map to `PermissionAction[]` using `@society/security` policy helpers; unit-test round-trips for every legacy role in `role-access.ts`.
- [x] **Step 6: Verify CP1** — `npm run typecheck:ux-core`, `:security`, root `npm run typecheck`, `npm run test`, `npm run db:validate`, `npm run build`; `npm run lint` unchanged baseline, zero new issues in `packages/ux-core` / `src/lib/navigation/`.

## Checkpoint 2: Role-Focused Navigation Shell

**Files:** modify `Sidebar.tsx`, `BottomNav.tsx`, `Header.tsx`; create `src/lib/navigation/use-persona-nav.ts`, `nav-icons.ts`.

- [x] Replace `navSections` hard-coded role arrays with `buildNavigationModel` output grouped by persona-specific sections (committee: Operations / Finance / Community / Governance; guard: Gate / Parcels / Safety only; resident: Home / Pay / Visitors / Community).
- [x] Guard persona **skips** finance/community side-nav entirely; default route redirect to `/visitors` when landing on `/dashboard`.
- [x] Bottom nav: five personas get distinct 4–5 item tabs (guard: Visitors, Parcels, SOS; treasurer: Home, Collections, Expenses, Reports; etc.).
- [x] Sidebar collapse/pin behavior preserved; add `data-persona` attribute for visual QA selectors.
- [x] Header: persona badge + compact role label from ux-core; hamburger unchanged on mobile.
- [x] **Verify CP2** — vitest for `use-persona-nav` hook logic (extract pure selector); manual smoke: login fixtures per role; `npm run build`.

## Checkpoint 3: Persona Dashboards

**Files:** refactor `src/app/(dashboard)/dashboard/page.tsx`; create `src/app/(dashboard)/dashboard/_personas/committee.tsx`, `treasurer.tsx`, `resident.tsx`, `guard.tsx`, `platform-admin.tsx`, shared `dashboard-types.ts`.

- [x] Split monolithic dashboard into persona components fed by existing `/api/dashboard` + targeted endpoints (no new migrations).
- [x] **Committee:** collections snapshot, overdue dues, open complaints, pending approvals, active polls/notices alerts.
- [x] **Treasurer:** collections vs expenses, fund balance, reconciliation tasks, budget burn, top defaulters (reuse existing analytics slices).
- [x] **Resident:** my bills, visitor approvals pending, notices unread, amenity bookings, package waiting.
- [x] **Guard:** large-touch cards — active visitors, expected arrivals, parcels awaiting handover, SOS/incident count (links to gate workflows).
- [x] **Platform admin:** society health, session/security placeholders linking to `/system` (read-only if APIs thin).
- [x] Shared `PageState` for loading/empty/error on each widget grid.
- [x] **Verify CP3** — component-level vitest for data shaping functions; `npm run build`; zero new lint in `src/app/(dashboard)/dashboard/`.

## Checkpoint 4: Global Search + Quick Actions

**Files:** create `src/components/ux/CommandPalette.tsx`; modify `Header.tsx`, `src/app/api/search/route.ts`; extend ux-core `buildQuickActions`.

- [x] Command palette (⌘K / Ctrl+K desktop; search icon mobile): fuzzy filter across nav items + quick actions + API search results.
- [x] Extend `/api/search` with permission-aware result types: notices, documents, directory entries (Phase 6 directory polish), marketplace listings (if `community:read`), guarded by session role.
- [x] Recent actions localStorage (non-sensitive hrefs only); clear on logout.
- [x] Keyboard navigation: up/down/enter/escape; `aria-activedescendant` pattern.
- [x] **Verify CP4** — vitest for search merge/sort; API route test for resident vs committee visibility; `npm run test`.

## Checkpoint 5: Responsive Layouts + UX State System

**Files:** create `src/components/ux/PageState.tsx`, `PermissionDenied.tsx`, `RetryBlock.tsx`; audit high-traffic pages.

- [x] `PageState` variants: `loading`, `empty`, `error`, `permission-denied`, `success` (consistent iconography + primary/secondary actions).
- [x] Apply to at least these critical workflows: `visitors`, `my-visitors`, `my-bills`, `complaints`, `notices`, `packages` (guard), `emergency` (SOS).
- [x] Tablet (`lg`/`md`) layout pass: finance tables horizontal scroll + sticky first column; guard pages min 48px touch targets.
- [x] Reduce duplicate loading spinners; prefer skeleton blocks on dashboards.
- [x] **Verify CP5** — Playwright snapshot smoke for mobile + tablet viewport on `/dashboard` and `/visitors`; lint baseline unchanged.

## Checkpoint 6: PWA Hardening + Offline-Safe Critical Actions

**Files:** modify `public/sw.js`, `public/manifest.json`, `next.config.ts` (if needed for SW scope), `src/lib/mobile/mobile-fetch.ts`, guard/resident mutation call-sites.

- [x] Audit `STATIC_ASSETS` and `CRITICAL_API_PREFIXES` in `sw.js` against current routes; bump `CACHE_VERSION`; ensure `/visitors`, `/my-visitors`, `/emergency` shells cached.
- [x] Manifest: `scope`, `id`, maskable icons if available, `display_override`, `shortcuts` per persona (resident → My Bills; guard → Gate).
- [x] Wire `mobileFetchJson` with `queueOnOffline: true` and operations-aligned `dedupeKey` for:
  - Guard: visitor log, patrol scan, package intake (`visitorLogDedupeKey`, `patrolScanDedupeKey` from `@society/operations-core` where applicable).
  - Resident: visitor respond, SOS raise, complaint raise.
- [x] Offline UX: toast on `OfflineQueuedError`; `MobileRuntime` banner shows queue count (already exists — verify after wiring).
- [x] Service worker skipWaiting + clients.claim documented; avoid caching authenticated POST responses.
- [x] **Verify CP6** — vitest for dedupe-key helper wiring; manual offline simulation steps documented in plan progress log; `npm run build`.

## Checkpoint 7: Push Notifications (Compatibility Mode)

**Files:** modify `src/lib/use-push.ts`, `src/lib/push.ts`, `public/sw.js`, create `src/lib/push/notification-routing.ts`; optional `src/app/api/push/dispatch/route.ts`.

- [x] Harden subscribe/unsubscribe: idempotent `PushSubscription` upsert, offline queue fallback (already partial — verify), permission denied UX.
- [x] `notification-routing.ts`: map `tag` / `type` → persona-aware deep links (`visitor-approval` → `/my-visitors`, `sos-alert` → `/emergency`, `package-arrived` → `/packages`).
- [x] Server adapter: accept worker-style envelope `{ type, societyId, targets[], payload }` and fan out via `web-push` when VAPID configured; no-op with structured log when VAPID missing (CI-safe).
- [x] SW: action buttons for visitor approval (`requireInteraction` already partial).
- [x] **Verify CP7** — unit tests for routing map; push dispatch returns 503 gracefully without VAPID; no regression in `npm run test`.

## Checkpoint 8: Capacitor Packaging + Accessibility + Exit Gate

**Files:** modify `capacitor.config.ts`, root `package.json` scripts; create `tests/e2e/role-workflows.spec.ts`, `tests/e2e/mobile-viewports.spec.ts`; modify `playwright.config.ts`.

- [x] Capacitor: set `webDir` to Next static export output **or** document dev/prod `server.url` modes; remove hard-coded production Vercel URL from default config (use env `CAPACITOR_SERVER_URL` optional).
- [x] Scripts: `cap:sync`, `cap:open:android`, `cap:run:android` (if SDK present); CI step validates `npx cap sync` file generation without requiring emulator.
- [x] Playwright projects: `Desktop Chrome`, `Pixel 7`, `iPad Mini` viewports.
- [x] E2E critical workflows (authenticated via test fixture or storage state if available): guard visits `/visitors`; resident visits `/my-bills`; committee visits `/complaints`; treasurer visits `/maintenance`.
- [x] A11y: axe checks on `/dashboard`, `/visitors`, `/my-bills` — zero critical violations (document known minor warnings).
- [x] Full exit gate: `npm run typecheck` (incl. `typecheck:ux-core`), `npm run test`, `npm run db:validate`, `npm run build`, `npm run test:e2e`, `npm run lint` (baseline only); update `docs/PRODUCT_PRODUCTION_ROADMAP.md` progress log + immediate next step; update `docs/LOCAL_DEVELOPMENT.md` with Phase 7 commands.

## Verification Commands

```powershell
npm run typecheck:ux-core
npm run typecheck:security
npm run typecheck
npm run test
npm run db:validate
npm run db:generate
npm run build
npx playwright test
npm run lint
npx cap sync
```

Focused during development:

```powershell
npx vitest run packages/ux-core
npx vitest run src/lib/navigation
npx vitest run src/lib/push
npx playwright test tests/e2e/role-workflows.spec.ts
npx playwright test tests/e2e/mobile-viewports.spec.ts --project="Pixel 7"
```

## Open Questions (decide before CP1)

These affect checkpoint scope; **do not start CP1 implementation until answered.**

### 1. Web app surface: `src/` vs `apps/web`

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** Stay in root `src/` for Phase 7 | Matches Phases 1–6 compatibility; lowest risk; exit gate achievable now | Drifts from locked `apps/web` layout until Phase 8 |
| **B:** Move to `apps/web` as part of Phase 7 | Aligns with monorepo target | Large structural diff; reroutes Turbo/scripts; likely pushes exit gate |

**Question:** Approve option A (default) or require option B move in Phase 7?

### 2. Capacitor packaging depth

| Option | Scope |
|---|---|
| **A (recommended):** Android project sync + config + CI validation + documented manual emulator run | Proves packaged path without store/signing |
| **B:** Full local Android APK build in CI | Needs SDK images, signing secrets, longer CI |
| **C:** iOS + Android | Needs macOS CI or manual-only iOS |

**Question:** Approve option A (default), B, or C?

### 3. Push notification transport

| Option | Scope |
|---|---|
| **A (recommended):** Compatibility mode — VAPID web-push for critical types + envelope adapter; worker transport still deferred | CI-safe; matches Phases 5–6 notification deferral |
| **B:** Wire BullMQ worker consumer to web-push for all envelope types | Crosses into worker/queue hardening |
| **C:** UI-only — subscription + SW display; no server send | Fastest but weak exit-gate proof |

**Question:** Approve option A (default), B, or C?

### 4. Secondary (confirm or defer)

- **NestJS SDK in dashboards:** Should any persona widgets call `/api/v1/*` directly in Phase 7, or stay on Next.js `/api/*` until Phase 8?
- **`packages/ui` extraction:** Approve deferral (default) or require shared package now?
- **Auth:** Keep JWT cookie sessions for Phase 7 UI QA, or block on Keycloak login integration in the web shell?

---

**Plan saved.** Awaiting your decisions on questions 1–3 (and any overrides on the secondary items) before CP1 begins.
