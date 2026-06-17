import { describe, expect, it } from "vitest";
import { buildReportPdfFilename, renderReportPdf } from "./report-pdf";

describe("renderReportPdf", () => {
  it("generates a monthly report PDF", async () => {
    const bytes = await renderReportPdf({
      societyName: "Green Valley",
      type: "monthly",
      periodLabel: "June 2026",
      monthly: {
        summary: {
          totalFlats: 50,
          activeFlats: 48,
          vacantFlats: 2,
          billsGenerated: 48,
          paid: 40,
          pending: 8,
          totalCollected: 200000,
          totalPending: 40000,
          collectionRate: 83,
        },
        paymentMethodBreakdown: [{ method: "upi", count: 30, amount: 150000 }],
        pendingFlats: [{ flatNumber: "A-101", ownerName: "Test Owner", contact: "9999999999", amount: 5000 }],
      },
    });

    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });
});

describe("buildReportPdfFilename", () => {
  it("names monthly exports by period", () => {
    expect(buildReportPdfFilename("monthly", "2026-06")).toBe("monthly-report-2026-06.pdf");
  });
});
