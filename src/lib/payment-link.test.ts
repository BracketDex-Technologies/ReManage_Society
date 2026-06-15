import { describe, expect, it } from "vitest";
import {
  billTotalAmount,
  buildPaymentReminderMessage,
  buildPublicPayUrl,
  buildUpiDeepLink,
  buildWhatsAppShareUrl,
  normalizeWhatsAppPhone,
  paymentLinkExpiresAt,
} from "@/lib/payment-link";

describe("payment-link helpers", () => {
  it("builds public pay URLs", () => {
    expect(buildPublicPayUrl("abc123", "https://app.example.com")).toBe(
      "https://app.example.com/pay/abc123",
    );
  });

  it("normalizes Indian phone numbers for WhatsApp", () => {
    expect(normalizeWhatsAppPhone("9876543210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("+91 98765 43210")).toBe("919876543210");
  });

  it("computes bill totals", () => {
    expect(
      billTotalAmount({ amount: 2500, lateFee: 100, gstAmount: 0, totalAmount: null }),
    ).toBe(2600);
  });

  it("builds UPI deep links", () => {
    const link = buildUpiDeepLink({
      upiId: "society@upi",
      payeeName: "Green Valley CHS",
      amount: 2500,
      transactionRef: "PAY-2026-06-A101",
      transactionNote: "Maintenance 2026-06",
    });
    expect(link).toContain("upi://pay?");
    expect(link).toContain("pa=society%40upi");
    expect(link).toContain("am=2500.00");
  });

  it("builds WhatsApp share URLs", () => {
    const url = buildWhatsAppShareUrl("Hello", "9876543210");
    expect(url).toContain("https://wa.me/919876543210?text=");
  });

  it("builds reminder messages with pay link", () => {
    const message = buildPaymentReminderMessage({
      societyName: "Green Valley",
      flatNumber: "A-101",
      period: "2026-06",
      amount: 2500,
      dueDate: new Date("2026-06-10"),
      payUrl: "https://app.example.com/pay/token",
      description: "Monthly Maintenance",
    });
    expect(message).toContain("Green Valley");
    expect(message).toContain("https://app.example.com/pay/token");
    expect(message).toContain("₹2,500");
  });

  it("sets payment link expiry 90 days ahead", () => {
    const from = new Date("2026-06-10T00:00:00.000Z");
    const expires = paymentLinkExpiresAt(from);
    expect(expires.getUTCDate()).toBe(8);
    expect(expires.getUTCMonth()).toBe(8);
  });
});
