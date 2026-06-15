import { describe, expect, it } from "vitest";
import {
  AMC_COMPLIANCE_ALERT_DAYS,
  complianceAlertDedupeKey,
  mapVendorCategoryToComplaintCategory,
  planSocietyComplianceAlerts,
  planVendorComplianceAlerts,
  shouldOpenComplianceTicket,
} from "./amc-compliance.ts";

const now = new Date("2026-06-10T12:00:00.000Z");

describe("planVendorComplianceAlerts", () => {
  it("opens AMC alert when contract expires within 30 days", () => {
    const alerts = planVendorComplianceAlerts(
      {
        id: "v1",
        name: "LiftCo",
        category: "lift",
        hasAMC: true,
        amcEndDate: new Date("2026-07-01T00:00:00.000Z"),
        insuranceExpiryDate: null,
      },
      now,
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "vendor_amc_expiry",
      vendorId: "v1",
      priority: "high",
      coverageStatus: "expiring_soon",
    });
    expect(alerts[0]?.title).toMatch(/LiftCo/);
  });

  it("opens insurance alert when certificate is expired", () => {
    const alerts = planVendorComplianceAlerts(
      {
        id: "v2",
        name: "FireSafe",
        category: "security",
        hasAMC: false,
        insuranceExpiryDate: new Date("2026-05-01T00:00:00.000Z"),
      },
      now,
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "vendor_insurance_expiry",
      coverageStatus: "expired",
      complaintCategory: "security",
    });
  });

  it("skips vendors with active coverage beyond alert window", () => {
    const alerts = planVendorComplianceAlerts(
      {
        id: "v3",
        name: "CleanPro",
        category: "cleaning",
        hasAMC: true,
        amcEndDate: new Date("2027-01-01T00:00:00.000Z"),
      },
      now,
    );

    expect(alerts).toHaveLength(0);
  });
});

describe("planSocietyComplianceAlerts", () => {
  it("aggregates alerts across vendors", () => {
    const alerts = planSocietyComplianceAlerts(
      [
        {
          id: "v1",
          name: "LiftCo",
          category: "lift",
          hasAMC: true,
          amcEndDate: new Date("2026-06-20T00:00:00.000Z"),
        },
        {
          id: "v2",
          name: "SecureGuard",
          category: "security",
          hasAMC: false,
          insuranceExpiryDate: new Date("2026-06-15T00:00:00.000Z"),
        },
      ],
      now,
    );

    expect(alerts).toHaveLength(2);
    expect(new Set(alerts.map((alert) => alert.kind))).toEqual(
      new Set(["vendor_amc_expiry", "vendor_insurance_expiry"]),
    );
  });
});

describe("compliance helpers", () => {
  it("maps vendor categories to complaint categories", () => {
    expect(mapVendorCategoryToComplaintCategory("lift")).toBe("general");
    expect(mapVendorCategoryToComplaintCategory("electrical")).toBe("electrical");
  });

  it("dedupes open compliance tickets by source key", () => {
    const alert = planVendorComplianceAlerts(
      {
        id: "v1",
        name: "LiftCo",
        category: "lift",
        hasAMC: true,
        amcEndDate: new Date("2026-06-20T00:00:00.000Z"),
      },
      now,
    )[0]!;

    const key = complianceAlertDedupeKey("vendor_amc_expiry", "v1");
    expect(alert.dedupeKey).toBe(key);
    expect(
      shouldOpenComplianceTicket({
        alert,
        openSourceKeys: new Set([key]),
      }),
    ).toBe(false);
    expect(
      shouldOpenComplianceTicket({
        alert,
        openSourceKeys: new Set(),
      }),
    ).toBe(true);
  });

  it("uses a 30-day default alert window", () => {
    expect(AMC_COMPLIANCE_ALERT_DAYS).toBe(30);
  });
});
