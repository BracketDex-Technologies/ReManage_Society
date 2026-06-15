import { Prisma } from "@prisma/client";
import { DEFAULT_LEDGER_ACCOUNTS, assertBalancedLedger } from "@/domain/accounting";
import { generateSocietyReceiptNumber } from "@/lib/utils";

type FinanceTx = Prisma.TransactionClient;

type MaintenanceBillWithFinance = Prisma.MaintenanceBillGetPayload<{
  include: {
    flat: { include: { units: { select: { id: true }, take: 1 } } };
    society: { select: { joinCode: true } };
  };
}>;

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function billTotal(bill: { amount: number; lateFee: number; gstAmount: number; totalAmount: number | null }) {
  return roundMoney(bill.totalAmount ?? bill.amount + bill.lateFee + bill.gstAmount);
}

function normalizeCodePart(value: string | null | undefined, fallback: string) {
  return (value || fallback).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase();
}

function incomeAccountForBillType(billType: string) {
  if (billType === "parking") return "3010";
  return "3000";
}

function moneyAccountForMethod(method: string) {
  return method.toLowerCase() === "cash" ? "1000" : "1010";
}

function statusForPaidAmount(paidAmount: number, totalAmount: number) {
  if (paidAmount <= 0) return "pending";
  return paidAmount >= totalAmount ? "paid" : "partial";
}

async function ensureDefaultAccounts(tx: FinanceTx, societyId: string) {
  await tx.ledgerAccount.createMany({
    data: DEFAULT_LEDGER_ACCOUNTS.map((account) => ({
      societyId,
      code: account.code,
      name: account.name,
      type: account.type,
    })),
    skipDuplicates: true,
  });
}

async function postLedgerEntries(
  tx: FinanceTx,
  params: {
    societyId: string;
    sourceType: string;
    sourceId: string;
    description: string;
    transactionDate: Date;
    createdBy?: string;
    paymentId?: string;
    invoiceId?: string;
    lines: Array<{ accountCode: string; debit: number; credit: number; memo: string }>;
  },
) {
  const existing = await tx.financialTransaction.findFirst({
    where: {
      societyId: params.societyId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    },
  });
  if (existing) return existing;

  const lines = params.lines.map((line) => ({
    ...line,
    debit: roundMoney(line.debit),
    credit: roundMoney(line.credit),
  }));
  assertBalancedLedger(lines);
  await ensureDefaultAccounts(tx, params.societyId);

  const accounts = await tx.ledgerAccount.findMany({
    where: {
      societyId: params.societyId,
      code: { in: lines.map((line) => line.accountCode) },
      isActive: true,
    },
  });
  const accountByCode = new Map(accounts.map((account) => [account.code, account.id]));
  const missing = lines.map((line) => line.accountCode).filter((code) => !accountByCode.has(code));
  if (missing.length > 0) {
    throw new Error(`Ledger account not found: ${missing.join(", ")}`);
  }

  const transaction = await tx.financialTransaction.create({
    data: {
      societyId: params.societyId,
      paymentId: params.paymentId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      description: params.description,
      transactionDate: params.transactionDate,
      createdBy: params.createdBy,
    },
  });

  await tx.ledgerEntry.createMany({
    data: lines.map((line) => ({
      societyId: params.societyId,
      transactionId: transaction.id,
      accountId: accountByCode.get(line.accountCode)!,
      invoiceId: params.invoiceId,
      debit: line.debit,
      credit: line.credit,
      memo: line.memo,
      postedAt: params.transactionDate,
    })),
  });

  return transaction;
}

async function findBill(tx: FinanceTx, societyId: string, billId: string): Promise<MaintenanceBillWithFinance> {
  const bill = await tx.maintenanceBill.findFirst({
    where: { id: billId, societyId },
    include: {
      flat: { include: { units: { select: { id: true }, take: 1 } } },
      society: { select: { joinCode: true } },
    },
  });
  if (!bill) {
    throw new Error("Bill not found");
  }

  return bill;
}

export async function ensureMaintenanceBillInvoice(
  tx: FinanceTx,
  params: { societyId: string; billId: string; createdBy?: string },
) {
  const bill = await findBill(tx, params.societyId, params.billId);
  if (bill.invoiceId) {
    return tx.invoice.findUniqueOrThrow({ where: { id: bill.invoiceId } });
  }

  const totalAmount = billTotal(bill);
  const invoiceNumber = [
    "INV",
    normalizeCodePart(bill.society.joinCode, "SOC"),
    normalizeCodePart(bill.period, "PERIOD"),
    normalizeCodePart(bill.flat.flatNumber, "FLAT"),
    bill.id.slice(-6).toUpperCase(),
  ].join("-");

  const invoice = await tx.invoice.create({
    data: {
      societyId: params.societyId,
      unitId: bill.flat.units[0]?.id,
      invoiceNumber,
      period: bill.period,
      issueDate: bill.createdAt,
      dueDate: bill.dueDate,
      status: bill.status === "paid" ? "PAID" : bill.status === "partial" ? "PARTIAL" : "ISSUED",
      subtotal: bill.amount,
      taxAmount: bill.gstAmount,
      penaltyAmount: bill.lateFee,
      totalAmount,
      paidAmount: roundMoney(bill.paidAmount ?? 0),
      notes: bill.description,
      lineItems: {
        create: {
          description: bill.description || "Society dues",
          category: bill.billType,
          quantity: 1,
          unitAmount: bill.amount,
          taxAmount: bill.gstAmount + bill.lateFee,
          totalAmount,
        },
      },
    },
  });

  await tx.maintenanceBill.update({
    where: { id: bill.id },
    data: { invoiceId: invoice.id },
  });

  await postLedgerEntries(tx, {
    societyId: params.societyId,
    sourceType: "INVOICE",
    sourceId: invoice.id,
    description: `Invoice ${invoice.invoiceNumber}`,
    transactionDate: bill.createdAt,
    createdBy: params.createdBy,
    invoiceId: invoice.id,
    lines: [
      { accountCode: "1100", debit: totalAmount, credit: 0, memo: "Accounts receivable" },
      {
        accountCode: incomeAccountForBillType(bill.billType),
        debit: 0,
        credit: totalAmount,
        memo: bill.description || "Society dues income",
      },
    ],
  });

  return invoice;
}

export async function recordMaintenanceBillPayment(
  tx: FinanceTx,
  params: {
    societyId: string;
    billId: string;
    desiredPaidAmount: number;
    paidVia: string;
    paidAt: Date;
    receiptNote?: string | null;
    reference?: string | null;
    createdBy?: string;
  },
) {
  const bill = await findBill(tx, params.societyId, params.billId);
  const totalAmount = billTotal(bill);
  const desiredPaidAmount = roundMoney(params.desiredPaidAmount);
  const previousPaidAmount = roundMoney(bill.paidAmount ?? 0);

  if (!Number.isFinite(desiredPaidAmount) || desiredPaidAmount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }
  if (desiredPaidAmount > totalAmount) {
    throw new Error("Payment amount cannot exceed invoice total");
  }
  if (desiredPaidAmount < previousPaidAmount) {
    throw new Error("Recorded payments are immutable. Add another payment or keep the existing paid amount.");
  }

  const invoice = await ensureMaintenanceBillInvoice(tx, {
    societyId: params.societyId,
    billId: params.billId,
    createdBy: params.createdBy,
  });
  const delta = roundMoney(desiredPaidAmount - previousPaidAmount);
  const nextStatus = statusForPaidAmount(desiredPaidAmount, totalAmount);
  let receiptNumber = bill.receiptNumber;

  if (delta > 0) {
    const payment = await tx.payment.create({
      data: {
        societyId: params.societyId,
        invoiceId: invoice.id,
        amount: delta,
        method: params.paidVia.toUpperCase(),
        reference: params.reference || params.receiptNote || undefined,
        status: "SUCCESS",
        paidAt: params.paidAt,
      },
    });

    const receiptCount = await tx.receipt.count({ where: { societyId: params.societyId } });
    receiptNumber = generateSocietyReceiptNumber(bill.society.joinCode, params.paidAt.getFullYear(), receiptCount + 1);
    await tx.receipt.create({
      data: {
        societyId: params.societyId,
        paymentId: payment.id,
        receiptNumber,
        issuedAt: params.paidAt,
        notes: params.receiptNote || params.reference || undefined,
      },
    });

    await postLedgerEntries(tx, {
      societyId: params.societyId,
      paymentId: payment.id,
      sourceType: "PAYMENT",
      sourceId: payment.id,
      description: `Payment for ${invoice.invoiceNumber}`,
      transactionDate: params.paidAt,
      createdBy: params.createdBy,
      invoiceId: invoice.id,
      lines: [
        {
          accountCode: moneyAccountForMethod(params.paidVia),
          debit: delta,
          credit: 0,
          memo: "Manual payment received",
        },
        {
          accountCode: "1100",
          debit: 0,
          credit: delta,
          memo: "Accounts receivable settled",
        },
      ],
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: { increment: delta },
        status: nextStatus === "paid" ? "PAID" : "PARTIAL",
      },
    });
  }

  return tx.maintenanceBill.update({
    where: { id: bill.id },
    data: {
      status: nextStatus,
      paidAt: params.paidAt,
      paidVia: params.paidVia,
      paidAmount: desiredPaidAmount,
      receiptNote: params.receiptNote || null,
      receiptNumber,
    },
    include: { flat: true },
  });
}
