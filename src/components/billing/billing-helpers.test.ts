import { describe, expect, it } from "vitest";
import {
  buildDefaultDueDate,
  generateMaintenanceUpiLink,
  getBillTotal,
  sortBillsByPriority,
} from "./billing-helpers";

describe("getBillTotal", () => {
  it("uses totalAmount when present", () => {
    expect(getBillTotal({ totalAmount: 1500, amount: 1000, lateFee: 100, gstAmount: 50 })).toBe(1500);
  });

  it("sums amount, late fee, and gst when totalAmount is missing", () => {
    expect(getBillTotal({ amount: 1000, lateFee: 100, gstAmount: 50 })).toBe(1150);
  });
});

describe("generateMaintenanceUpiLink", () => {
  it("builds a valid upi deeplink", () => {
    const link = generateMaintenanceUpiLink({
      upiId: "society@upi",
      societyName: "Green Valley",
      amount: 2500,
      period: "2026-06",
      flatNumber: "A-101",
    });
    expect(link).toContain("upi://pay?");
    expect(link).toContain("pa=society@upi");
    expect(link).toContain("am=2500.00");
    expect(link).toContain("tr=MAINT-2026-06-A-101");
  });
});

describe("sortBillsByPriority", () => {
  it("orders pending before paid and by due date", () => {
    const sorted = sortBillsByPriority([
      { id: "paid", status: "paid", dueDate: "2026-01-01" },
      { id: "pending-late", status: "pending", dueDate: "2026-05-01" },
      { id: "pending-soon", status: "pending", dueDate: "2026-06-01" },
    ] as Array<{ id: string; status: string; dueDate: string }>);
    expect(sorted.map((bill) => bill.id)).toEqual(["pending-late", "pending-soon", "paid"]);
  });
});

describe("buildDefaultDueDate", () => {
  it("returns due date for period", () => {
    expect(buildDefaultDueDate("2026-06", 10)).toBe("2026-06-10");
  });
});
