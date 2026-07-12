import { describe, expect, it } from "vitest";
import {
  calculateSocietyPortalStats,
  generateTemporaryPassword,
  isDeletedSociety,
  isSocietyAccessDisabled,
} from "@/lib/portal-admin";

describe("portal admin helpers", () => {
  it("generates a shareable temporary password without ambiguous characters", () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(12);
    expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]+$/);
  });

  it("calculates collection, pending, expenses, and balance from society records", () => {
    const stats = calculateSocietyPortalStats({
      openingBalance: 1000,
      bills: [
        { amount: 2500, lateFee: 100, gstAmount: 0, totalAmount: null, paidAmount: 2600 },
        { amount: 3000, lateFee: 0, gstAmount: 540, totalAmount: 3540, paidAmount: 1000 },
        { amount: 2000, lateFee: 0, gstAmount: 0, totalAmount: null, paidAmount: null },
      ],
      expenses: [{ amount: 750 }, { amount: 1250 }],
    });

    expect(stats.totalCollected).toBe(3600);
    expect(stats.pendingAmount).toBe(4540);
    expect(stats.totalExpenses).toBe(2000);
    expect(stats.balance).toBe(2600);
  });

  it("identifies soft-deleted societies", () => {
    expect(isDeletedSociety({ deletedAt: null })).toBe(false);
    expect(isDeletedSociety({ deletedAt: new Date("2026-07-12T00:00:00.000Z") })).toBe(true);
  });

  it("identifies disabled society access", () => {
    expect(isSocietyAccessDisabled({ accessDisabledAt: null })).toBe(false);
    expect(isSocietyAccessDisabled({ accessDisabledAt: "2026-07-12T00:00:00.000Z" })).toBe(true);
  });
});
