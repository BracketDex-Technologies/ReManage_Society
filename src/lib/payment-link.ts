import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";

export const PAYMENT_LINK_TTL_DAYS = 90;

export function generatePaymentLinkToken(): string {
  return randomBytes(24).toString("base64url");
}

export function paymentLinkExpiresAt(from = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + PAYMENT_LINK_TTL_DAYS);
  return expires;
}

export function buildPublicPayUrl(token: string, origin?: string): string {
  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/pay/${token}`;
}

export function billTotalAmount(bill: {
  amount: number;
  lateFee: number;
  gstAmount: number;
  totalAmount: number | null;
}) {
  return Math.round((bill.totalAmount ?? bill.amount + bill.lateFee + bill.gstAmount) * 100) / 100;
}

export function buildUpiDeepLink(input: {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionRef: string;
  transactionNote: string;
}) {
  const params = new URLSearchParams({
    pa: input.upiId,
    pn: input.payeeName.slice(0, 50),
    tr: input.transactionRef.slice(0, 35),
    tn: input.transactionNote.slice(0, 80),
    am: input.amount.toFixed(2),
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}

export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length >= 10) return digits;
  return null;
}

export function buildWhatsAppShareUrl(message: string, phone?: string | null): string {
  const encoded = encodeURIComponent(message);
  const normalized = normalizeWhatsAppPhone(phone);
  if (normalized) {
    return `https://wa.me/${normalized}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function buildPaymentReminderMessage(input: {
  societyName: string;
  flatNumber: string;
  period: string;
  amount: number;
  dueDate: Date;
  payUrl: string;
  description?: string | null;
}) {
  const dueLabel = input.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const title = input.description || "Maintenance dues";
  return [
    `🏠 *${input.societyName}*`,
    ``,
    `Dear Flat ${input.flatNumber} resident,`,
    ``,
    `Your ${title} for *${input.period}* is due.`,
    `Amount: *₹${input.amount.toLocaleString("en-IN")}*`,
    `Due date: ${dueLabel}`,
    ``,
    `Pay in one tap — no app login needed:`,
    input.payUrl,
    ``,
    `Thank you!`,
  ].join("\n");
}

type BillWithRelations = Prisma.MaintenanceBillGetPayload<{
  include: {
    flat: { select: { flatNumber: true; ownerName: true } };
    society: { select: { name: true; upiId: true } };
  };
}>;

export function serializePublicBillView(bill: BillWithRelations, payUrl: string) {
  const total = billTotalAmount(bill);
  const remaining = Math.max(0, Math.round((total - (bill.paidAmount ?? 0)) * 100) / 100);

  return {
    id: bill.id,
    flatNumber: bill.flat.flatNumber,
    ownerName: bill.flat.ownerName,
    societyName: bill.society.name,
    upiId: bill.society.upiId,
    description: bill.description,
    period: bill.period,
    billType: bill.billType,
    amount: bill.amount,
    lateFee: bill.lateFee,
    gstAmount: bill.gstAmount,
    totalAmount: total,
    remainingAmount: remaining,
    dueDate: bill.dueDate.toISOString(),
    status: bill.status,
    paidAmount: bill.paidAmount,
    receiptNumber: bill.receiptNumber,
    payUrl,
    isPayable: bill.status !== "paid" && remaining > 0,
  };
}
