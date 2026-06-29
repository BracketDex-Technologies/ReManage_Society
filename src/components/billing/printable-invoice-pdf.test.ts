import { describe, expect, it } from "vitest";
import { buildPrintableInvoicePdfFilename, renderPrintableInvoicePdf } from "./printable-invoice-pdf";

describe("renderPrintableInvoicePdf", () => {
  it("generates a printable PDF for selected custom invoice flats", async () => {
    const bytes = await renderPrintableInvoicePdf({
      societyName: "APCOER Society of Highest In Heavens To The Hells",
      period: "2026-06",
      description: "Monthly Maintenance",
      amount: 2500,
      dueDate: "2026-06-10",
      flats: [
        { flatNumber: "A-101", payerName: "Resident One", payerRole: "Owner" },
        { flatNumber: "B-202", payerName: "Resident Two", payerRole: "Tenant" },
      ],
    });

    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });
});

describe("buildPrintableInvoicePdfFilename", () => {
  it("names exports by invoice title and period", () => {
    expect(buildPrintableInvoicePdfFilename("Monthly Maintenance", "2026-06")).toBe(
      "monthly-maintenance-invoices-2026-06.pdf",
    );
  });
});
