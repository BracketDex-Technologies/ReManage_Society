# Phase 0 Product Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the production roadmap and complete a full current-product audit before changing the core stack.

**Architecture:** This phase is documentation and analysis only. It does not change runtime behavior, database schema, dependencies, API contracts, or UI implementation.

**Tech Stack:** Current repo inspection, Markdown documentation, Prisma schema review, Next.js route/page inventory.

---

## Task 1: Lock The Roadmap

**Files:**
- Create: `docs/PRODUCT_PRODUCTION_ROADMAP.md`
- Create: `docs/superpowers/plans/2026-06-05-phase-0-product-audit.md`

- [x] Confirm `docs/PRODUCT_PRODUCTION_ROADMAP.md` contains the locked goal, current assessment, target stack, architecture, UX direction, phases, quality gates, and deferred decisions.
- [x] Confirm this plan exists and states that Phase 0 is documentation/audit only.
- [ ] Commit after verification with message `docs: lock production roadmap`.

## Task 2: Build Current Module Inventory

**Files:**
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`

- [x] List top-level API modules from `src/app/api`.
- [x] List dashboard modules from `src/app/(dashboard)`.
- [x] Record route/page counts.
- [x] Record Prisma model count and model names.
- [x] Record existing product comparison source: `compare.md`.
- [x] Add a module inventory table with columns: `Area`, `Current Surface`, `Current Status`, `Recommended Disposition`, `Reason`, `Phase`.
- [ ] Commit with message `docs: add product module inventory`.

## Task 3: Add Risk Register

**Files:**
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`

- [x] Add a risk register with columns: `Risk`, `Impact`, `Evidence`, `Mitigation`, `Target Phase`.
- [x] Include risks for tenant isolation, authorization duplication, finance correctness, payments, jobs, notifications, mobile, tests, observability, backups, CSP, and deployment.
- [ ] Commit with message `docs: add production risk register`.

## Task 4: Add Module Acceptance Criteria

**Files:**
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`

- [x] Add acceptance criteria for each module group: foundation, society core, finance, operations/security, community/governance, mobile/UX, and release hardening.
- [x] Make the criteria testable and tied to the mandatory quality gates.
- [ ] Commit with message `docs: add module acceptance criteria`.

## Task 5: Prepare Phase 1 Plan Input

**Files:**
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`
- Create: `docs/superpowers/plans/2026-06-05-phase-1-engineering-foundation-outline.md`

- [x] Add a Phase 1 input checklist: workspace structure, package manager, Docker services, API scaffold, worker scaffold, config validation, logging, health checks, OpenAPI, tests, CI, and rollback constraints.
- [x] Create a short Phase 1 outline document that can become the detailed engineering-foundation implementation plan.
- [ ] Commit with message `docs: outline phase 1 foundation plan`.

## Phase 0 Verification

- [x] Run `git status --short`. Result: only `docs/` is untracked.
- [x] Run `npm run lint` to preserve current lint baseline. Result: command timed out after printing 57 problems: 28 errors and 29 warnings.
- [ ] Run `npm run build` if no Phase 0 doc-only changes unexpectedly affect runtime. Not run in this pass because Phase 0 changed documentation only and lint already fails on existing source issues.
- [x] Confirm no source code, dependency, Prisma schema, or runtime config changed in Phase 0.
- [x] Final Phase 0 handoff must state remaining lint/build baseline honestly.
