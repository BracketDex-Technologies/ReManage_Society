import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCE_ACCOUNTS,
  buildReceiptNumber,
  createJournalPostingPlan,
  expensePostingLines,
  invoicePostingLines,
  paymentPostingLines,
  payrollPostingLines,
  razorpayWebhookIdempotencyKey,
} from "./index.ts";

describe("DEFAULT_FINANCE_ACCOUNTS", () => {
  it("provides the minimum chart needed for Phase 4 posting plans", () => {
    expect(DEFAULT_FINANCE_ACCOUNTS.map((account) => account.code)).toEqual([
      "1000",
      "1010",
      "1100",
      "1200",
      "2000",
      "2100",
      "3000",
      "3010",
      "3020",
      "4000",
      "4010",
      "4020",
      "4030",
      "5000",
    ]);
  });
});

describe("createJournalPostingPlan", () => {
  it("creates an auditable balanced journal posting plan", () => {
    const plan = createJournalPostingPlan({
      societyId: "society_a",
      sourceType: "INVOICE",
      sourceId: "invoice_1",
      idempotencyKey: "invoice_1:post",
      narration: "Maintenance invoice A-101",
      lines: invoicePostingLines(2500),
    });

    expect(plan).toEqual({
      societyId: "society_a",
      sourceType: "INVOICE",
      sourceId: "invoice_1",
      idempotencyKey: "invoice_1:post",
      narration: "Maintenance invoice A-101",
      totalDebit: 2500,
      totalCredit: 2500,
      lines: [
        {
          accountCode: "1100",
          side: "DEBIT",
          amount: 2500,
          memo: "Accounts receivable",
        },
        {
          accountCode: "3000",
          side: "CREDIT",
          amount: 2500,
          memo: "Maintenance income",
        },
      ],
    });
  });

  it("rejects unbalanced journal postings", () => {
    expect(() =>
      createJournalPostingPlan({
        societyId: "society_a",
        sourceType: "MANUAL_JOURNAL",
        sourceId: "journal_1",
        idempotencyKey: "journal_1:post",
        narration: "Broken journal",
        lines: [
          { accountCode: "1010", side: "DEBIT", amount: 1000 },
          { accountCode: "3000", side: "CREDIT", amount: 999 },
        ],
      }),
    ).toThrow("Ledger posting is not balanced: debit=1000, credit=999");
  });

  it("rejects missing idempotency keys", () => {
    expect(() =>
      createJournalPostingPlan({
        societyId: "society_a",
        sourceType: "MANUAL_JOURNAL",
        sourceId: "journal_1",
        idempotencyKey: " ",
        narration: "No idempotency key",
        lines: [
          { accountCode: "1010", side: "DEBIT", amount: 1000 },
          { accountCode: "3000", side: "CREDIT", amount: 1000 },
        ],
      }),
    ).toThrow("Idempotency key is required for financial postings.");
  });

  it("rejects invalid journal lines before totals are trusted", () => {
    expect(() =>
      createJournalPostingPlan({
        societyId: "society_a",
        sourceType: "MANUAL_JOURNAL",
        sourceId: "journal_1",
        idempotencyKey: "journal_1:post",
        narration: "Invalid line",
        lines: [
          { accountCode: "1010", side: "DEBIT", amount: 0 },
          { accountCode: "3000", side: "CREDIT", amount: 0 },
        ],
      }),
    ).toThrow("Ledger line amount must be greater than zero.");
  });
});

describe("posting line helpers", () => {
  it("maps payment collection to bank debit and receivable credit", () => {
    expect(paymentPostingLines(2500)).toEqual([
      {
        accountCode: "1010",
        side: "DEBIT",
        amount: 2500,
        memo: "Payment received",
      },
      {
        accountCode: "1100",
        side: "CREDIT",
        amount: 2500,
        memo: "Accounts receivable settled",
      },
    ]);
  });

  it("maps paid expenses to expense debit and bank credit", () => {
    expect(expensePostingLines(1800, "4020")).toEqual([
      {
        accountCode: "4020",
        side: "DEBIT",
        amount: 1800,
        memo: "Expense recognized",
      },
      {
        accountCode: "1010",
        side: "CREDIT",
        amount: 1800,
        memo: "Payment made",
      },
    ]);
  });

  it("maps payroll payment to salaries debit and bank credit", () => {
    expect(payrollPostingLines(32000)).toEqual([
      {
        accountCode: "4000",
        side: "DEBIT",
        amount: 32000,
        memo: "Payroll expense recognized",
      },
      {
        accountCode: "1010",
        side: "CREDIT",
        amount: 32000,
        memo: "Payroll payment made",
      },
    ]);
  });
});

describe("receipt and webhook helpers", () => {
  it("builds stable society receipt numbers", () => {
    expect(buildReceiptNumber("PALM", 2026, 12)).toBe("RCPT-PALM-2026-00012");
  });

  it("rejects invalid receipt sequences", () => {
    expect(() => buildReceiptNumber("PALM", 2026, 0)).toThrow(
      "Receipt sequence must be greater than zero.",
    );
  });

  it("builds deterministic Razorpay webhook idempotency keys", () => {
    expect(
      razorpayWebhookIdempotencyKey({
        eventId: "evt_123",
        paymentId: "pay_456",
      }),
    ).toBe("razorpay:evt_123:pay_456");
  });
});
