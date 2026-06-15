import { describe, expect, it } from "vitest";
import {
  AMC_COMPLIANCE_ALERT_DAYS,
  planVendorComplianceAlerts,
} from "@society/operations-core";

describe("AMC compliance contract", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");

  it("creates high-priority renewal plans 30 days before AMC expiry", () => {
    const alerts = planVendorComplianceAlerts(
      {
        id: "vendor_lift",
        name: "Otis Elevators",
        category: "lift",
        hasAMC: true,
        amcEndDate: new Date("2026-07-05T00:00:00.000Z"),
      },
      now,
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.priority).toBe("high");
    expect(alerts[0]?.kind).toBe("vendor_amc_expiry");
    expect(alerts[0]?.description).toMatch(/renew/i);
  });

  it("tracks insurance expiry separately from AMC", () => {
    const alerts = planVendorComplianceAlerts(
      {
        id: "vendor_fire",
        name: "Fire Safety Co",
        category: "security",
        hasAMC: false,
        insuranceExpiryDate: new Date("2026-06-25T00:00:00.000Z"),
      },
      now,
    );

    expect(alerts[0]?.kind).toBe("vendor_insurance_expiry");
    expect(AMC_COMPLIANCE_ALERT_DAYS).toBe(30);
  });
});
