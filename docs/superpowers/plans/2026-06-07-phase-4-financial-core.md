# Phase 4 Financial Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 4 financial core so society money flows are correct, auditable, tenant-scoped, and retry-safe.

**Architecture:** Start with a pure `@society/finance-core` package for accounting invariants and posting plans, then expose those rules through the NestJS API with Phase 2 authorization and Phase 3 tenant context. Persistence stays behind API repositories that use the existing Prisma finance models until a dedicated migration checkpoint is approved.

**Tech Stack:** TypeScript, Vitest, NestJS/Fastify, Prisma, `@society/security`, `@society/db`, existing Phase 1/2/3 workspace scripts.

---

## File Structure

- Create: `packages/finance-core/package.json`
- Create: `packages/finance-core/tsconfig.json`
- Create: `packages/finance-core/src/index.ts`
- Create: `packages/finance-core/src/finance-core.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Later checkpoint create: `apps/api/src/finance-core/finance-core.module.ts`
- Later checkpoint create: `apps/api/src/finance-core/finance-core.service.ts`
- Later checkpoint create: `apps/api/src/finance-core/finance-core.controller.ts`
- Later checkpoint create: `apps/api/src/finance-core/finance-core.repository.ts`
- Later checkpoint modify: `apps/api/src/app.module.ts`
- Later checkpoint modify: `packages/security/src/types.ts`
- Later checkpoint modify: `packages/security/src/permission-policy.ts`
- Later checkpoint modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`
- Later checkpoint modify: `docs/LOCAL_DEVELOPMENT.md`

## Checkpoint 1: Finance Domain Foundation

**Files:**
- Create: `packages/finance-core/package.json`
- Create: `packages/finance-core/tsconfig.json`
- Create: `packages/finance-core/src/index.ts`
- Create: `packages/finance-core/src/finance-core.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write failing tests for default accounts and journal validation**

Add `packages/finance-core/src/finance-core.test.ts` with tests that import `DEFAULT_FINANCE_ACCOUNTS`, `createJournalPostingPlan`, `invoicePostingLines`, `paymentPostingLines`, and `expensePostingLines` from `./index.ts`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run packages/finance-core/src/finance-core.test.ts`

Expected: fails because `packages/finance-core/src/index.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal finance-core package**

Add a package that exports:

```ts
export type FinanceAccountType = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
export type JournalSide = "DEBIT" | "CREDIT";
export interface JournalPostingLineInput {
  accountCode: string;
  side: JournalSide;
  amount: number;
  memo?: string;
}
export interface JournalPostingPlan {
  idempotencyKey: string;
  societyId: string;
  sourceType: string;
  sourceId: string;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  lines: readonly JournalPostingLineInput[];
}
```

The implementation must reject one-line vouchers, mixed debit/credit on one line, zero/negative amounts, missing idempotency keys, and unbalanced totals.

- [ ] **Step 4: Run focused finance-core verification**

Run: `npx vitest run packages/finance-core/src/finance-core.test.ts`

Expected: all finance-core tests pass.

- [ ] **Step 5: Run package type-check**

Run: `npm run typecheck:finance-core`

Expected: exit 0.

## Checkpoint 2: Finance API Authorization Boundary

**Files:**
- Modify: `packages/security/src/types.ts`
- Modify: `packages/security/src/permission-policy.ts`
- Create: `apps/api/src/finance-core/finance-core.service.ts`
- Create: `apps/api/src/finance-core/finance-core.service.test.ts`

- [ ] **Step 1: Write failing service tests**

Test that `society:finance.read` is required for trial-balance style reads and `society:finance.manage` is required for chart/accounting mutations.

- [ ] **Step 2: Implement Phase 4 permission actions**

Add `society:finance.read` and `society:finance.manage`. Treasurer, committee, society admin, and platform admin can read finance. Treasurer, society admin, and platform admin can manage finance. MFA is required for manage.

- [ ] **Step 3: Implement `FinanceCoreService`**

The service delegates pure posting-plan creation to `@society/finance-core` and calls `SecurityPolicyService.authorizeOrThrow` before every operation.

- [ ] **Step 4: Verify**

Run `npx vitest run apps/api/src/finance-core/finance-core.service.test.ts packages/security/src/permission-policy.test.ts` and `npm run typecheck:api`.

## Checkpoint 3: Chart Of Accounts And Journal Persistence

**Files:**
- Create: `apps/api/src/finance-core/finance-core.repository.ts`
- Create: `apps/api/src/finance-core/finance-core.repository.test.ts`
- Create: `apps/api/src/finance-core/finance-core.controller.ts`
- Create: `apps/api/src/finance-core/finance-core.controller.test.ts`
- Create: `apps/api/src/finance-core/finance-core.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write repository tests with a fake Prisma boundary**

Test idempotent default chart creation, missing account rejection, balanced journal persistence, and duplicate idempotency-key replay.

- [ ] **Step 2: Implement repository**

Use existing Prisma models: `LedgerAccount`, `JournalVoucher`, `JournalVoucherLine`, `FinancialTransaction`, and `LedgerEntry`.

- [ ] **Step 3: Add controller routes**

Expose tenant-protected Phase 4 endpoints under `/api/v1/finance-core`:

```text
POST /chart-of-accounts/ensure
POST /journal-vouchers/plan
POST /journal-vouchers/post
POST /reports/trial-balance
```

- [ ] **Step 4: Verify**

Run focused API finance tests, `npm run typecheck:api`, and `npm run test`.

## Checkpoint 4: Billing, Payments, Receipts, And Idempotency

**Files:**
- Modify: `packages/finance-core/src/index.ts`
- Modify: `packages/finance-core/src/finance-core.test.ts`
- Modify: `apps/api/src/finance-core/finance-core.repository.ts`
- Modify: `apps/api/src/finance-core/finance-core.repository.test.ts`
- Modify: `apps/api/src/finance-core/finance-core.controller.ts`
- Modify: `apps/api/src/finance-core/finance-core.controller.test.ts`

- [ ] **Step 1: Add failing tests for invoice, payment, receipt, and webhook posting plans**

Test invoice debit to accounts receivable, payment debit to bank/cash and credit to accounts receivable, receipt number generation input validation, and Razorpay webhook idempotency key shape.

- [ ] **Step 2: Implement billing and payment posting plans**

Add `invoicePostingLines`, `paymentPostingLines`, and receipt metadata builders.

- [ ] **Step 3: Persist invoice/payment/receipt flows**

Use existing `Invoice`, `InvoiceLineItem`, `InvoiceRecipient`, `Payment`, and `Receipt` models. Require idempotency keys for mutation commands.

- [ ] **Step 4: Verify**

Run focused finance tests, `npm run typecheck:finance-core`, `npm run typecheck:api`, `npm run test`, `npm run db:validate`, and `npm run build`.

## Checkpoint 5: Expenses, Funds, Budgets, Payroll, Reconciliation, Reports, Workers

**Files:**
- Modify: `packages/finance-core/src/index.ts`
- Modify: `packages/finance-core/src/finance-core.test.ts`
- Modify: `apps/api/src/finance-core/*`
- Modify: `apps/worker/src/*`
- Modify: `docs/PRODUCT_PRODUCTION_ROADMAP.md`
- Modify: `docs/LOCAL_DEVELOPMENT.md`

- [ ] **Step 1: Add failing tests for expense, fund, budget, payroll, reconciliation, and worker commands**

Each test must prove the accounting entry, idempotency key, tenant context, and audit metadata.

- [ ] **Step 2: Implement repository/API slices one workflow at a time**

Do not mix payroll, budget, and reconciliation in one unverified edit. Each workflow gets a focused test, minimal implementation, focused verification, and then moves to the next workflow.

- [ ] **Step 3: Add worker command envelopes**

Billing reminders and reconciliation workers must use deterministic job IDs and be safe to retry.

- [ ] **Step 4: Verify Phase 4 exit gate**

Run `npm run typecheck:finance-core`, `npm run typecheck:api`, `npm run typecheck:worker`, root `npm run typecheck`, `npm run test`, `npm run db:validate`, `npm run db:generate`, `npm run build`, and record the known `npm run lint` baseline without hiding it.

