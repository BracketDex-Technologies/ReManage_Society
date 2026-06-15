import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { AuthenticatedApiRequest } from "../security/authentication.guard.ts";
import { FinanceCoreController } from "./finance-core.controller.ts";
import type { FinanceCoreService } from "./finance-core.service.ts";

const request: AuthenticatedApiRequest = {
  headers: {},
  principal: {
    subject: "treasurer_1",
    memberships: [
      {
        societyId: "society_a",
        roles: ["treasurer"],
        mfaVerified: true,
      },
    ],
    platformRoles: [],
  },
};

describe("FinanceCoreController", () => {
  it("ensures chart of accounts through the authenticated principal", async () => {
    const controller = new FinanceCoreController({
      ensureChartOfAccounts: async () => ({
        societyId: "society_a",
        accounts: [{ code: "1100", name: "Accounts Receivable", type: "ASSET" }],
      }),
    } as unknown as FinanceCoreService);

    await expect(
      controller.ensureChartOfAccounts(request, { societyId: "society_a" }),
    ).resolves.toMatchObject({
      societyId: "society_a",
      accounts: [expect.objectContaining({ code: "1100" })],
    });
  });

  it("posts journal vouchers through the authenticated principal", async () => {
    const controller = new FinanceCoreController({
      postJournalVoucher: async () => ({
        posted: true,
        replayed: false,
        transactionId: "txn_1",
        voucherId: "voucher_1",
        voucherNumber: "JV-2026-00001",
        totalDebit: 1000,
        totalCredit: 1000,
      }),
    } as unknown as FinanceCoreService);

    await expect(
      controller.postJournalVoucher(request, {
        societyId: "society_a",
        sourceType: "MANUAL_JOURNAL",
        sourceId: "journal_1",
        idempotencyKey: "journal_1:post",
        narration: "Opening balance",
        lines: [
          { accountCode: "1010", side: "DEBIT", amount: 1000 },
          { accountCode: "5000", side: "CREDIT", amount: 1000 },
        ],
      }),
    ).resolves.toMatchObject({
      posted: true,
      voucherNumber: "JV-2026-00001",
    });
  });

  it("creates invoices through the authenticated principal", async () => {
    const controller = new FinanceCoreController({
      createInvoice: async () => ({
        created: true,
        replayed: false,
        invoiceId: "invoice_1",
        invoiceNumber: "INV-2026-00001",
        totalAmount: 2500,
      }),
    } as unknown as FinanceCoreService);

    await expect(
      controller.createInvoice(request, {
        societyId: "society_a",
        invoiceNumber: "INV-2026-00001",
        period: "2026-06",
        dueDate: "2026-06-30T00:00:00.000Z",
        idempotencyKey: "invoice:INV-2026-00001",
        lineItems: [
          {
            description: "Maintenance June",
            category: "maintenance",
            quantity: 1,
            unitAmount: 2500,
          },
        ],
      }),
    ).resolves.toMatchObject({
      created: true,
      invoiceNumber: "INV-2026-00001",
    });
  });

  it("records payments through the authenticated principal", async () => {
    const controller = new FinanceCoreController({
      recordPayment: async () => ({
        recorded: true,
        replayed: false,
        paymentId: "payment_1",
        receiptId: "receipt_1",
        receiptNumber: "RCPT-PALM-2026-00001",
        totalDebit: 2500,
        totalCredit: 2500,
      }),
    } as unknown as FinanceCoreService);

    await expect(
      controller.recordPayment(request, {
        societyId: "society_a",
        invoiceId: "invoice_1",
        amount: 2500,
        method: "GATEWAY",
        reference: "pay_123",
        receiptPrefix: "PALM",
        paidAt: "2026-06-07T00:00:00.000Z",
        idempotencyKey: "payment:pay_123",
      }),
    ).resolves.toMatchObject({
      recorded: true,
      receiptNumber: "RCPT-PALM-2026-00001",
    });
  });

  it("records expenses through the authenticated principal", async () => {
    const controller = new FinanceCoreController({
      recordExpense: async () => ({
        recorded: true,
        expenseId: "expense_1",
        totalDebit: 1800,
        totalCredit: 1800,
      }),
    } as unknown as FinanceCoreService);

    await expect(
      controller.recordExpense(request, {
        societyId: "society_a",
        title: "Utilities",
        amount: 1800,
        category: "utilities",
        paidOn: "2026-06-07T00:00:00.000Z",
        fiscalYear: "2026-27",
        idempotencyKey: "expense:utilities",
      }),
    ).resolves.toMatchObject({
      recorded: true,
      expenseId: "expense_1",
    });
  });

  it("rejects direct calls without an attached principal", () => {
    const controller = new FinanceCoreController({} as FinanceCoreService);

    expect(() =>
      controller.ensureChartOfAccounts(
        {
          headers: {},
        },
        { societyId: "society_a" },
      ),
    ).toThrow(UnauthorizedException);
  });
});
