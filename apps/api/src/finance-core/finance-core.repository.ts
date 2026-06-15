import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  DEFAULT_FINANCE_ACCOUNTS,
  buildReceiptNumber,
  createJournalPostingPlan,
  invoicePostingLines,
  paymentPostingLines,
  expensePostingLines,
  payrollPostingLines,
  type FinanceAccountDefinition,
  type JournalPostingLineInput,
} from "../../../../packages/finance-core/src/index.ts";

export interface FinancePersistenceClient {
  $transaction: <T>(callback: (transaction: FinancePersistenceClient) => Promise<T>) => Promise<T>;
  ledgerAccount: {
    createMany: (input: unknown) => Promise<unknown>;
    findMany: (input?: unknown) => Promise<FinanceLedgerAccount[]>;
  };
  financialTransaction: {
    findFirst: (input: unknown) => Promise<{ id: string } | null>;
    create: (input: unknown) => Promise<{ id: string }>;
  };
  journalVoucher: {
    count: (input: unknown) => Promise<number>;
    create: (input: unknown) => Promise<{ id: string; voucherNumber: string }>;
  };
  ledgerEntry: {
    createMany: (input: unknown) => Promise<unknown>;
    groupBy: (input: unknown) => Promise<FinanceLedgerGroup[]>;
  };
  invoice: {
    findFirst: (input: unknown) => Promise<{ id: string; invoiceNumber: string; totalAmount: number } | null>;
    create: (input: unknown) => Promise<{ id: string; invoiceNumber: string; totalAmount: number; paidAmount: number }>;
    update: (input: unknown) => Promise<unknown>;
  };
  payment: {
    findFirst: (input: unknown) => Promise<{ id: string; amount: number; reference: string | null } | null>;
    create: (input: unknown) => Promise<{ id: string; amount: number; reference: string | null }>;
  };
  receipt: {
    count: (input: unknown) => Promise<number>;
    create: (input: unknown) => Promise<{ id: string; receiptNumber: string }>;
  };
  expense: {
    create: (input: unknown) => Promise<{ id: string; amount: number; title: string }>;
  };
  budget: {
    upsert: (input: unknown) => Promise<{ id: string; fiscalYear: string; category: string }>;
    updateMany: (input: unknown) => Promise<unknown>;
  };
  fundAccount: {
    findUnique: (input: unknown) => Promise<{ id: string; balance: number } | null>;
    update: (input: unknown) => Promise<{ id: string; balance: number }>;
  };
  fundTransaction: {
    create: (input: unknown) => Promise<{ id: string; balanceAfter: number }>;
  };
  staffSalary: {
    update: (input: unknown) => Promise<{ id: string; netPay: number; status: string }>;
  };
}

export interface FinanceLedgerAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface FinanceLedgerGroup {
  accountId: string;
  _sum: {
    debit: number | null;
    credit: number | null;
  };
}

export interface PostJournalVoucherInput {
  societyId: string;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  narration: string;
  createdBy?: string;
  voucherDate?: Date;
  lines: readonly JournalPostingLineInput[];
}

export interface TrialBalanceInput {
  societyId: string;
  from?: Date;
  to?: Date;
}

export interface CreateInvoiceLineInput {
  description: string;
  category: string;
  quantity: number;
  unitAmount: number;
  taxAmount?: number;
}

export interface CreateInvoiceInput {
  societyId: string;
  invoiceNumber: string;
  period: string;
  dueDate: Date;
  unitId?: string;
  idempotencyKey: string;
  createdBy?: string;
  lineItems: readonly CreateInvoiceLineInput[];
}

export interface RecordPaymentInput {
  societyId: string;
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string;
  receiptPrefix: string;
  paidAt: Date;
  idempotencyKey: string;
  createdBy?: string;
}

export interface RecordExpenseInput {
  societyId: string;
  title: string;
  amount: number;
  category: string;
  paidTo?: string;
  paidOn: Date;
  fiscalYear?: string;
  idempotencyKey: string;
  createdBy?: string;
}

export interface UpsertBudgetInput {
  societyId: string;
  fiscalYear: string;
  category: string;
  planned: number;
  notes?: string;
}

export interface RecordFundTransactionInput {
  societyId: string;
  fundId: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  reference?: string;
  createdBy?: string;
}

export interface MarkPayrollPaidInput {
  societyId: string;
  salaryId: string;
  netPay: number;
  paidOn: Date;
  paidVia: string;
  idempotencyKey: string;
  createdBy?: string;
}

@Injectable()
export class FinanceCoreRepository {
  constructor(
    private readonly client: FinancePersistenceClient = prisma as unknown as FinancePersistenceClient,
  ) {}

  async ensureDefaultChartOfAccounts(societyId: string) {
    await this.client.ledgerAccount.createMany({
      data: DEFAULT_FINANCE_ACCOUNTS.map((account) => ({
        societyId,
        code: account.code,
        name: account.name,
        type: account.type,
      })),
      skipDuplicates: true,
    });

    const accounts = await this.findActiveAccounts(societyId);
    return { societyId, accounts };
  }

  async postJournalVoucher(input: PostJournalVoucherInput) {
    const existingTransaction = await this.client.financialTransaction.findFirst({
      where: {
        societyId: input.societyId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    });

    if (existingTransaction) {
      return {
        posted: true,
        replayed: true,
        transactionId: existingTransaction.id,
        voucherId: null,
        voucherNumber: null,
        totalDebit: 0,
        totalCredit: 0,
      };
    }

    const plan = createJournalPostingPlan(input);
    const accounts = await this.ensureDefaultChartOfAccounts(input.societyId);
    const accountByCode = new Map(accounts.accounts.map((account) => [account.code, account]));
    const missingAccounts = plan.lines
      .map((line) => line.accountCode)
      .filter((code) => !accountByCode.has(code));

    if (missingAccounts.length > 0) {
      throw new Error(`Ledger account not found: ${missingAccounts.join(", ")}`);
    }

    const voucherDate = input.voucherDate ?? new Date();
    const voucherNumber = await this.nextJournalVoucherNumber(input.societyId, voucherDate);

    return this.client.$transaction(async (transactionClient) => {
      const financialTransaction = await transactionClient.financialTransaction.create({
        data: {
          societyId: plan.societyId,
          sourceType: plan.sourceType,
          sourceId: plan.sourceId,
          description: plan.narration,
          transactionDate: voucherDate,
          createdBy: input.createdBy,
        },
      });

      const voucher = await transactionClient.journalVoucher.create({
        data: {
          societyId: plan.societyId,
          voucherNumber,
          voucherDate,
          narration: plan.narration,
          createdBy: input.createdBy,
          postedAt: new Date(),
          lines: {
            create: plan.lines.map((line) => ({
              accountId: accountByCode.get(line.accountCode)!.id,
              debit: line.side === "DEBIT" ? line.amount : 0,
              credit: line.side === "CREDIT" ? line.amount : 0,
              memo: line.memo,
            })),
          },
        },
      });

      await transactionClient.ledgerEntry.createMany({
        data: plan.lines.map((line) => ({
          societyId: plan.societyId,
          transactionId: financialTransaction.id,
          accountId: accountByCode.get(line.accountCode)!.id,
          debit: line.side === "DEBIT" ? line.amount : 0,
          credit: line.side === "CREDIT" ? line.amount : 0,
          memo: line.memo ?? plan.narration,
          postedAt: voucherDate,
        })),
      });

      return {
        posted: true,
        replayed: false,
        transactionId: financialTransaction.id,
        voucherId: voucher.id,
        voucherNumber: voucher.voucherNumber,
        totalDebit: plan.totalDebit,
        totalCredit: plan.totalCredit,
      };
    });
  }

  async getTrialBalance(input: TrialBalanceInput) {
    const accounts = await this.findActiveAccounts(input.societyId);
    const grouped = await this.client.ledgerEntry.groupBy({
      by: ["accountId"],
      where: {
        societyId: input.societyId,
        postedAt: {
          ...(input.from ? { gte: input.from } : {}),
          ...(input.to ? { lte: input.to } : {}),
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });
    const sums = new Map(grouped.map((row) => [row.accountId, row._sum]));
    const rows = accounts.map((account) => {
      const sum = sums.get(account.id);
      const debit = sum?.debit ?? 0;
      const credit = sum?.credit ?? 0;
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
        balance: debit - credit,
      };
    });

    return {
      societyId: input.societyId,
      rows,
      totals: {
        debit: rows.reduce((sum, row) => sum + row.debit, 0),
        credit: rows.reduce((sum, row) => sum + row.credit, 0),
      },
    };
  }

  async createInvoice(input: CreateInvoiceInput) {
    const existingInvoice = await this.client.invoice.findFirst({
      where: {
        societyId: input.societyId,
        invoiceNumber: input.invoiceNumber,
      },
    });

    if (existingInvoice) {
      return {
        created: true,
        replayed: true,
        invoiceId: existingInvoice.id,
        invoiceNumber: existingInvoice.invoiceNumber,
        totalAmount: existingInvoice.totalAmount,
      };
    }

    const lineItems = input.lineItems.map((line) => {
      const quantity = line.quantity || 1;
      const taxAmount = line.taxAmount ?? 0;
      const totalAmount = roundMoney(quantity * line.unitAmount + taxAmount);

      return {
        description: line.description,
        category: line.category,
        quantity,
        unitAmount: line.unitAmount,
        taxAmount,
        totalAmount,
      };
    });
    const totalAmount = roundMoney(lineItems.reduce((sum, line) => sum + line.totalAmount, 0));

    const invoice = await this.client.invoice.create({
      data: {
        societyId: input.societyId,
        unitId: input.unitId,
        invoiceNumber: input.invoiceNumber,
        period: input.period,
        dueDate: input.dueDate,
        status: "ISSUED",
        subtotal: totalAmount,
        totalAmount,
        lineItems: {
          create: lineItems,
        },
      },
    });

    await this.postJournalVoucher({
      societyId: input.societyId,
      sourceType: "INVOICE",
      sourceId: invoice.id,
      idempotencyKey: input.idempotencyKey,
      narration: `Invoice ${invoice.invoiceNumber}`,
      createdBy: input.createdBy,
      voucherDate: input.dueDate,
      lines: invoicePostingLines(totalAmount),
    });

    return {
      created: true,
      replayed: false,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
    };
  }

  async recordPayment(input: RecordPaymentInput) {
    if (input.reference) {
      const existingPayment = await this.client.payment.findFirst({
        where: {
          societyId: input.societyId,
          reference: input.reference,
        },
      });

      if (existingPayment) {
        return {
          recorded: true,
          replayed: true,
          paymentId: existingPayment.id,
          receiptId: null,
          receiptNumber: null,
          totalDebit: 0,
          totalCredit: 0,
        };
      }
    }

    const payment = await this.client.payment.create({
      data: {
        societyId: input.societyId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        status: "SUCCESS",
        paidAt: input.paidAt,
      },
    });
    const receiptCount = await this.client.receipt.count({
      where: { societyId: input.societyId },
    });
    const receiptNumber = buildReceiptNumber(
      input.receiptPrefix,
      input.paidAt.getFullYear(),
      receiptCount + 1,
    );
    const receipt = await this.client.receipt.create({
      data: {
        societyId: input.societyId,
        paymentId: payment.id,
        receiptNumber,
        issuedAt: input.paidAt,
        notes: input.reference ? `Reference: ${input.reference}` : undefined,
      },
    });

    await this.client.invoice.update({
      where: { id: input.invoiceId },
      data: {
        paidAmount: { increment: input.amount },
        status: "PAID",
      },
    });

    const posting = await this.postJournalVoucher({
      societyId: input.societyId,
      sourceType: "PAYMENT",
      sourceId: payment.id,
      idempotencyKey: input.idempotencyKey,
      narration: `Payment ${payment.id}`,
      createdBy: input.createdBy,
      voucherDate: input.paidAt,
      lines: paymentPostingLines(input.amount),
    });

    return {
      recorded: true,
      replayed: false,
      paymentId: payment.id,
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      totalDebit: posting.totalDebit,
      totalCredit: posting.totalCredit,
    };
  }

  async recordExpense(input: RecordExpenseInput) {
    const expense = await this.client.expense.create({
      data: {
        societyId: input.societyId,
        title: input.title,
        amount: input.amount,
        category: input.category,
        paidTo: input.paidTo,
        paidOn: input.paidOn,
      },
    });

    if (input.fiscalYear) {
      await this.client.budget.updateMany({
        where: {
          societyId: input.societyId,
          fiscalYear: input.fiscalYear,
          category: input.category,
        },
        data: {
          actual: { increment: input.amount },
        },
      });
    }

    const posting = await this.postJournalVoucher({
      societyId: input.societyId,
      sourceType: "EXPENSE",
      sourceId: expense.id,
      idempotencyKey: input.idempotencyKey,
      narration: `Expense ${expense.title}`,
      createdBy: input.createdBy,
      voucherDate: input.paidOn,
      lines: expensePostingLines(input.amount, accountCodeForExpenseCategory(input.category)),
    });

    return {
      recorded: true,
      expenseId: expense.id,
      totalDebit: posting.totalDebit,
      totalCredit: posting.totalCredit,
    };
  }

  async upsertBudget(input: UpsertBudgetInput) {
    const budget = await this.client.budget.upsert({
      where: {
        societyId_fiscalYear_category: {
          societyId: input.societyId,
          fiscalYear: input.fiscalYear,
          category: input.category,
        },
      },
      update: {
        planned: input.planned,
        notes: input.notes,
      },
      create: {
        societyId: input.societyId,
        fiscalYear: input.fiscalYear,
        category: input.category,
        planned: input.planned,
        notes: input.notes,
      },
    });

    return {
      budgetId: budget.id,
      fiscalYear: budget.fiscalYear,
      category: budget.category,
    };
  }

  async recordFundTransaction(input: RecordFundTransactionInput) {
    const fund = await this.client.fundAccount.findUnique({
      where: { id: input.fundId },
    });

    if (!fund) {
      throw new Error(`Fund account not found: ${input.fundId}`);
    }

    const signedAmount = input.type === "credit" ? input.amount : -input.amount;
    const balanceAfter = roundMoney(fund.balance + signedAmount);

    await this.client.fundAccount.update({
      where: { id: input.fundId },
      data: { balance: balanceAfter },
    });
    const transaction = await this.client.fundTransaction.create({
      data: {
        fundId: input.fundId,
        type: input.type,
        amount: input.amount,
        description: input.description,
        reference: input.reference,
        balanceAfter,
        createdBy: input.createdBy,
      },
    });

    return {
      recorded: true,
      fundTransactionId: transaction.id,
      balanceAfter: transaction.balanceAfter,
    };
  }

  async markPayrollPaid(input: MarkPayrollPaidInput) {
    const salary = await this.client.staffSalary.update({
      where: { id: input.salaryId },
      data: {
        status: "paid",
        paidOn: input.paidOn,
        paidVia: input.paidVia,
      },
    });
    const posting = await this.postJournalVoucher({
      societyId: input.societyId,
      sourceType: "PAYROLL",
      sourceId: salary.id,
      idempotencyKey: input.idempotencyKey,
      narration: `Payroll ${salary.id}`,
      createdBy: input.createdBy,
      voucherDate: input.paidOn,
      lines: payrollPostingLines(input.netPay),
    });

    return {
      paid: true,
      salaryId: salary.id,
      totalDebit: posting.totalDebit,
      totalCredit: posting.totalCredit,
    };
  }

  private findActiveAccounts(societyId: string) {
    return this.client.ledgerAccount.findMany({
      where: { societyId, isActive: true },
      orderBy: [{ code: "asc" }],
    });
  }

  private async nextJournalVoucherNumber(societyId: string, date: Date) {
    const year = date.getFullYear();
    const prefix = `JV-${year}-`;
    const count = await this.client.journalVoucher.count({
      where: {
        societyId,
        voucherNumber: { startsWith: prefix },
      },
    });

    return `${prefix}${String(count + 1).padStart(5, "0")}`;
  }
}

export type { FinanceAccountDefinition };

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function accountCodeForExpenseCategory(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes("salary")) return "4000";
  if (normalized.includes("utilit")) return "4020";
  if (normalized.includes("clean")) return "4030";
  return "4010";
}
