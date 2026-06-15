import { describe, expect, it } from "vitest";
import {
  FinanceCoreRepository,
  type FinancePersistenceClient,
} from "./finance-core.repository.ts";
import { invoicePostingLines } from "../../../../packages/finance-core/src/index.ts";

interface RepositoryOperation {
  model: string;
  action: string;
  input: unknown;
}

type RepositoryTestClient = FinancePersistenceClient & {
  operations: RepositoryOperation[];
};

function createRepositoryClient(options: { existingTransaction?: boolean } = {}) {
  const operations: RepositoryOperation[] = [];
  const accounts = [
    { id: "acct_bank", code: "1010", name: "Bank", type: "ASSET" },
    { id: "acct_ar", code: "1100", name: "Accounts Receivable", type: "ASSET" },
    { id: "acct_income", code: "3000", name: "Maintenance Income", type: "INCOME" },
    { id: "acct_salary", code: "4000", name: "Salaries", type: "EXPENSE" },
    { id: "acct_utilities", code: "4020", name: "Utilities", type: "EXPENSE" },
    { id: "acct_equity", code: "5000", name: "Opening Balance Equity", type: "EQUITY" },
  ];
  const client: RepositoryTestClient = {
    operations,
    $transaction: async <T>(callback: (transaction: typeof client) => Promise<T>) => callback(client),
    ledgerAccount: {
      createMany: async (input: unknown) => {
        operations.push({ model: "ledgerAccount", action: "createMany", input });
        return { count: 4 };
      },
      findMany: async () => accounts,
    },
    financialTransaction: {
      findFirst: async () =>
        options.existingTransaction
          ? {
              id: "txn_existing",
              sourceType: "INVOICE",
              sourceId: "invoice_1",
            }
          : null,
      create: async (input: unknown) => {
        operations.push({ model: "financialTransaction", action: "create", input });
        return { id: "txn_1" };
      },
    },
    journalVoucher: {
      count: async () => 0,
      create: async (input: unknown) => {
        operations.push({ model: "journalVoucher", action: "create", input });
        return { id: "voucher_1", voucherNumber: "JV-2026-00001" };
      },
    },
    ledgerEntry: {
      createMany: async (input: unknown) => {
        operations.push({ model: "ledgerEntry", action: "createMany", input });
        return { count: 2 };
      },
      groupBy: async () => [
        {
          accountId: "acct_ar",
          _sum: { debit: 2500, credit: 0 },
        },
        {
          accountId: "acct_income",
          _sum: { debit: 0, credit: 2500 },
        },
      ],
    },
    invoice: {
      findFirst: async () => null,
      create: async (input: unknown) => {
        operations.push({ model: "invoice", action: "create", input });
        return {
          id: "invoice_1",
          invoiceNumber: "INV-2026-00001",
          totalAmount: 2500,
          paidAmount: 0,
        };
      },
      update: async (input: unknown) => {
        operations.push({ model: "invoice", action: "update", input });
        return { id: "invoice_1", paidAmount: 2500, status: "PAID" };
      },
    },
    payment: {
      findFirst: async () => null,
      create: async (input: unknown) => {
        operations.push({ model: "payment", action: "create", input });
        return { id: "payment_1", amount: 2500, reference: "pay_123" };
      },
    },
    receipt: {
      count: async () => 0,
      create: async (input: unknown) => {
        operations.push({ model: "receipt", action: "create", input });
        return { id: "receipt_1", receiptNumber: "RCPT-PALM-2026-00001" };
      },
    },
    expense: {
      create: async (input: unknown) => {
        operations.push({ model: "expense", action: "create", input });
        return { id: "expense_1", amount: 1800, title: "Utilities" };
      },
    },
    budget: {
      upsert: async (input: unknown) => {
        operations.push({ model: "budget", action: "upsert", input });
        return { id: "budget_1", fiscalYear: "2026-27", category: "utilities" };
      },
      updateMany: async (input: unknown) => {
        operations.push({ model: "budget", action: "updateMany", input });
        return { count: 1 };
      },
    },
    fundAccount: {
      findUnique: async () => ({ id: "fund_1", balance: 10000 }),
      update: async (input: unknown) => {
        operations.push({ model: "fundAccount", action: "update", input });
        return { id: "fund_1", balance: 8200 };
      },
    },
    fundTransaction: {
      create: async (input: unknown) => {
        operations.push({ model: "fundTransaction", action: "create", input });
        return { id: "fund_txn_1", balanceAfter: 8200 };
      },
    },
    staffSalary: {
      update: async (input: unknown) => {
        operations.push({ model: "staffSalary", action: "update", input });
        return { id: "salary_1", netPay: 32000, status: "paid" };
      },
    },
  };

  return client;
}

describe("FinanceCoreRepository", () => {
  it("ensures the default chart of accounts idempotently", async () => {
    const client = createRepositoryClient();
    const repository = new FinanceCoreRepository(client);

    const result = await repository.ensureDefaultChartOfAccounts("society_a");

    expect(result.accounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "1100", name: "Accounts Receivable" }),
    ]));
    expect(client.operations[0]).toMatchObject({
      model: "ledgerAccount",
      action: "createMany",
    });
  });

  it("posts a balanced journal voucher and ledger entries", async () => {
    const client = createRepositoryClient();
    const repository = new FinanceCoreRepository(client);

    const result = await repository.postJournalVoucher({
      societyId: "society_a",
      sourceType: "INVOICE",
      sourceId: "invoice_1",
      idempotencyKey: "invoice_1:post",
      narration: "Maintenance invoice",
      createdBy: "treasurer_1",
      voucherDate: new Date("2026-06-07T00:00:00.000Z"),
      lines: invoicePostingLines(2500),
    });

    expect(result).toEqual({
      posted: true,
      replayed: false,
      transactionId: "txn_1",
      voucherId: "voucher_1",
      voucherNumber: "JV-2026-00001",
      totalDebit: 2500,
      totalCredit: 2500,
    });
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toEqual([
      "ledgerAccount.createMany",
      "financialTransaction.create",
      "journalVoucher.create",
      "ledgerEntry.createMany",
    ]);
  });

  it("replays duplicate source postings without writing duplicate ledger rows", async () => {
    const client = createRepositoryClient({ existingTransaction: true });
    const repository = new FinanceCoreRepository(client);

    await expect(
      repository.postJournalVoucher({
        societyId: "society_a",
        sourceType: "INVOICE",
        sourceId: "invoice_1",
        idempotencyKey: "invoice_1:post",
        narration: "Maintenance invoice",
        lines: invoicePostingLines(2500),
      }),
    ).resolves.toMatchObject({
      posted: true,
      replayed: true,
      transactionId: "txn_existing",
    });
    expect(client.operations).toEqual([]);
  });

  it("builds a trial balance from grouped ledger entries", async () => {
    const client = createRepositoryClient();
    const repository = new FinanceCoreRepository(client);

    await expect(repository.getTrialBalance({ societyId: "society_a" })).resolves.toMatchObject({
      totals: {
        debit: 2500,
        credit: 2500,
      },
      rows: expect.arrayContaining([
        expect.objectContaining({ code: "1100", debit: 2500, credit: 0 }),
        expect.objectContaining({ code: "3000", debit: 0, credit: 2500 }),
      ]),
    });
  });

  it("creates an issued invoice and posts receivable ledger entries", async () => {
    const client = createRepositoryClient();
    const repository = new FinanceCoreRepository(client);

    const result = await repository.createInvoice({
      societyId: "society_a",
      invoiceNumber: "INV-2026-00001",
      period: "2026-06",
      dueDate: new Date("2026-06-30T00:00:00.000Z"),
      idempotencyKey: "invoice:INV-2026-00001",
      createdBy: "treasurer_1",
      lineItems: [
        {
          description: "Maintenance June",
          category: "maintenance",
          quantity: 1,
          unitAmount: 2500,
        },
      ],
    });

    expect(result).toMatchObject({
      created: true,
      replayed: false,
      invoiceId: "invoice_1",
      invoiceNumber: "INV-2026-00001",
      totalAmount: 2500,
    });
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toContain(
      "invoice.create",
    );
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toContain(
      "ledgerEntry.createMany",
    );
  });

  it("records a payment, receipt, invoice status update, and settlement ledger entries", async () => {
    const client = createRepositoryClient();
    const repository = new FinanceCoreRepository(client);

    const result = await repository.recordPayment({
      societyId: "society_a",
      invoiceId: "invoice_1",
      amount: 2500,
      method: "GATEWAY",
      reference: "pay_123",
      receiptPrefix: "PALM",
      paidAt: new Date("2026-06-07T00:00:00.000Z"),
      idempotencyKey: "payment:pay_123",
      createdBy: "treasurer_1",
    });

    expect(result).toEqual({
      recorded: true,
      replayed: false,
      paymentId: "payment_1",
      receiptId: "receipt_1",
      receiptNumber: "RCPT-PALM-2026-00001",
      totalDebit: 2500,
      totalCredit: 2500,
    });
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toEqual([
      "payment.create",
      "receipt.create",
      "invoice.update",
      "ledgerAccount.createMany",
      "financialTransaction.create",
      "journalVoucher.create",
      "ledgerEntry.createMany",
    ]);
  });

  it("records expenses, updates budget actuals, and posts expense ledger entries", async () => {
    const client = createRepositoryClient();
    const repository = new FinanceCoreRepository(client);

    await expect(
      repository.recordExpense({
        societyId: "society_a",
        title: "Utilities",
        amount: 1800,
        category: "utilities",
        paidTo: "MSEB",
        paidOn: new Date("2026-06-07T00:00:00.000Z"),
        fiscalYear: "2026-27",
        idempotencyKey: "expense:utilities:2026-06-07",
        createdBy: "treasurer_1",
      }),
    ).resolves.toMatchObject({
      recorded: true,
      expenseId: "expense_1",
      totalDebit: 1800,
      totalCredit: 1800,
    });
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toContain(
      "budget.updateMany",
    );
  });

  it("upserts budgets without ledger side effects", async () => {
    const client = createRepositoryClient();
    const repository = new FinanceCoreRepository(client);

    await expect(
      repository.upsertBudget({
        societyId: "society_a",
        fiscalYear: "2026-27",
        category: "utilities",
        planned: 120000,
      }),
    ).resolves.toMatchObject({
      budgetId: "budget_1",
      fiscalYear: "2026-27",
      category: "utilities",
    });
  });

  it("records fund transactions with updated balances", async () => {
    const client = createRepositoryClient();
    const repository = new FinanceCoreRepository(client);

    await expect(
      repository.recordFundTransaction({
        societyId: "society_a",
        fundId: "fund_1",
        type: "debit",
        amount: 1800,
        description: "Utilities from reserve",
        createdBy: "treasurer_1",
      }),
    ).resolves.toEqual({
      recorded: true,
      fundTransactionId: "fund_txn_1",
      balanceAfter: 8200,
    });
  });

  it("marks payroll paid and posts salary ledger entries", async () => {
    const client = createRepositoryClient();
    const repository = new FinanceCoreRepository(client);

    await expect(
      repository.markPayrollPaid({
        societyId: "society_a",
        salaryId: "salary_1",
        netPay: 32000,
        paidOn: new Date("2026-06-07T00:00:00.000Z"),
        paidVia: "neft",
        idempotencyKey: "payroll:salary_1",
        createdBy: "treasurer_1",
      }),
    ).resolves.toMatchObject({
      paid: true,
      salaryId: "salary_1",
      totalDebit: 32000,
      totalCredit: 32000,
    });
  });
});
