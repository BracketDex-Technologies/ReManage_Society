import { describe, expect, it } from "vitest";
import {
  createJournalPostingPlan,
  invoicePostingLines,
  razorpayWebhookIdempotencyKey,
} from "@society/finance-core";
import {
  FinanceCoreRepository,
  type FinancePersistenceClient,
} from "../../apps/api/src/finance-core/finance-core.repository.ts";

type TestClient = FinancePersistenceClient & { operations: { model: string; action: string }[] };

function createClient(existing = false): TestClient {
  const operations: { model: string; action: string }[] = [];
  const client: TestClient = {
    operations,
    $transaction: async <T>(cb: (tx: typeof client) => Promise<T>) => cb(client),
    ledgerAccount: {
      createMany: async (input) => {
        operations.push({ model: "ledgerAccount", action: "createMany" });
        return { count: 4 };
      },
      findMany: async () => [
        { id: "acct_ar", code: "1100", name: "AR", type: "ASSET" },
        { id: "acct_income", code: "3000", name: "Income", type: "INCOME" },
      ],
    },
    financialTransaction: {
      findFirst: async () =>
        existing ? { id: "txn_existing", sourceType: "INVOICE", sourceId: "inv_1" } : null,
      create: async () => {
        operations.push({ model: "financialTransaction", action: "create" });
        return { id: "txn_1" };
      },
    },
    journalVoucher: {
      count: async () => 0,
      create: async () => {
        operations.push({ model: "journalVoucher", action: "create" });
        return { id: "v_1", voucherNumber: "JV-1" };
      },
    },
    ledgerEntry: {
      createMany: async () => {
        operations.push({ model: "ledgerEntry", action: "createMany" });
        return { count: 2 };
      },
      groupBy: async () => [],
    },
    invoice: {
      findFirst: async () => null,
      create: async () => ({ id: "inv_1", invoiceNumber: "INV-1", totalAmount: 1000, paidAmount: 0 }),
      update: async () => ({ id: "inv_1", paidAmount: 1000, status: "PAID" }),
    },
    payment: {
      findFirst: async () => null,
      create: async () => ({ id: "pay_1", amount: 1000, reference: "ref" }),
    },
    receipt: {
      count: async () => 0,
      create: async () => ({ id: "rcpt_1", receiptNumber: "R-1" }),
    },
    expense: { create: async () => ({ id: "exp_1", amount: 100, title: "Utilities" }) },
    budget: { upsert: async () => ({ id: "bud_1", fiscalYear: "2026", category: "ops" }), updateMany: async () => ({ count: 0 }) },
    fundAccount: { findUnique: async () => null, update: async () => ({ id: "fund_1", balance: 0 }) },
    fundTransaction: { create: async () => ({ id: "ft_1", balanceAfter: 0 }) },
    staffSalary: { update: async () => ({ id: "sal_1", netPay: 1000, status: "PAID" }) },
  };
  return client;
}

describe("finance critical contract", () => {
  it("requires idempotency keys for journal postings", () => {
    expect(() =>
      createJournalPostingPlan({
        societyId: "society_a",
        sourceType: "INVOICE",
        sourceId: "inv_1",
        idempotencyKey: " ",
        narration: "test",
        lines: invoicePostingLines(1000),
      }),
    ).toThrow("Idempotency key is required");
  });

  it("posts balanced journal entries once", async () => {
    const client = createClient();
    const repo = new FinanceCoreRepository(client);
    const result = await repo.postJournalVoucher({
      societyId: "society_a",
      sourceType: "INVOICE",
      sourceId: "inv_1",
      idempotencyKey: "inv_1:post",
      narration: "Invoice",
      lines: invoicePostingLines(1000),
    });
    expect(result.replayed).toBe(false);
    expect(result.totalDebit).toBe(result.totalCredit);
    expect(client.operations.length).toBeGreaterThan(0);
  });

  it("replays duplicate postings without extra writes", async () => {
    const client = createClient(true);
    const repo = new FinanceCoreRepository(client);
    const result = await repo.postJournalVoucher({
      societyId: "society_a",
      sourceType: "INVOICE",
      sourceId: "inv_1",
      idempotencyKey: "inv_1:post",
      narration: "Invoice",
      lines: invoicePostingLines(1000),
    });
    expect(result.replayed).toBe(true);
    expect(client.operations).toEqual([]);
  });

  it("builds deterministic razorpay webhook idempotency keys", () => {
    const key = razorpayWebhookIdempotencyKey({ eventId: "evt_1", paymentId: "pay_1" });
    expect(key).toBe("razorpay:evt_1:pay_1");
    expect(
      razorpayWebhookIdempotencyKey({ eventId: "evt_1", paymentId: "pay_1" }),
    ).toBe(key);
  });
});
