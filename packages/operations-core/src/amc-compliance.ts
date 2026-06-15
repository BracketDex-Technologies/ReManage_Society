export const AMC_COMPLIANCE_ALERT_DAYS = 30;

export type ComplianceAlertKind = "vendor_amc_expiry" | "vendor_insurance_expiry";

export type ComplianceCoverageStatus = "expiring_soon" | "expired";

export interface VendorComplianceSnapshot {
  id: string;
  name: string;
  category: string;
  hasAMC: boolean;
  amcEndDate?: Date | null;
  insuranceExpiryDate?: Date | null;
}

export interface ComplianceAlertPlan {
  kind: ComplianceAlertKind;
  vendorId: string;
  vendorName: string;
  endDate: Date;
  coverageStatus: ComplianceCoverageStatus;
  daysRemaining: number;
  title: string;
  description: string;
  complaintCategory: string;
  priority: "high";
  dedupeKey: string;
}

const COMPLAINT_CATEGORY_BY_VENDOR: Record<string, string> = {
  electrical: "electrical",
  plumbing: "plumbing",
  lift: "general",
  pest: "cleanliness",
  security: "security",
  cleaning: "cleanliness",
  other: "general",
};

function daysUntil(endDate: Date, now: Date) {
  return Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000);
}

function formatDateEnIn(value: Date) {
  return value.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function mapVendorCategoryToComplaintCategory(category: string): string {
  return COMPLAINT_CATEGORY_BY_VENDOR[category.trim().toLowerCase()] ?? "general";
}

export function complianceAlertDedupeKey(kind: ComplianceAlertKind, vendorId: string): string {
  return `${kind}:${vendorId}`;
}

function evaluateComplianceCoverage(input: {
  endDate: Date;
  now: Date;
  expiringWithinDays: number;
}): ComplianceCoverageStatus | null {
  const end = input.endDate.getTime();
  const now = input.now.getTime();

  if (end < now) {
    return "expired";
  }

  const daysLeft = (end - now) / 86_400_000;
  return daysLeft <= input.expiringWithinDays ? "expiring_soon" : null;
}

function buildAlert(input: {
  kind: ComplianceAlertKind;
  vendor: VendorComplianceSnapshot;
  endDate: Date;
  coverageStatus: ComplianceCoverageStatus;
  now: Date;
  label: string;
}): ComplianceAlertPlan {
  const daysRemaining = daysUntil(input.endDate, input.now);
  const expiryLabel = formatDateEnIn(input.endDate);
  const urgency =
    input.coverageStatus === "expired"
      ? `expired on ${expiryLabel}`
      : `expires on ${expiryLabel} (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left)`;

  return {
    kind: input.kind,
    vendorId: input.vendor.id,
    vendorName: input.vendor.name,
    endDate: input.endDate,
    coverageStatus: input.coverageStatus,
    daysRemaining,
    title: `${input.label} renewal required — ${input.vendor.name}`,
    description: [
      `Automated compliance alert for ${input.vendor.name} (${input.vendor.category}).`,
      `${input.label} ${urgency}.`,
      "Please review the contract, obtain quotes if needed, and renew before service lapse.",
      "Assign follow-up to the vendor and update AMC/insurance dates once renewed.",
    ].join(" "),
    complaintCategory: mapVendorCategoryToComplaintCategory(input.vendor.category),
    priority: "high",
    dedupeKey: complianceAlertDedupeKey(input.kind, input.vendor.id),
  };
}

export function planVendorComplianceAlerts(
  vendor: VendorComplianceSnapshot,
  now: Date,
  expiringWithinDays = AMC_COMPLIANCE_ALERT_DAYS,
): ComplianceAlertPlan[] {
  const alerts: ComplianceAlertPlan[] = [];

  if (vendor.hasAMC && vendor.amcEndDate) {
    const coverageStatus = evaluateComplianceCoverage({
      endDate: vendor.amcEndDate,
      now,
      expiringWithinDays,
    });
    if (coverageStatus) {
      alerts.push(
        buildAlert({
          kind: "vendor_amc_expiry",
          vendor,
          endDate: vendor.amcEndDate,
          coverageStatus,
          now,
          label: "AMC",
        }),
      );
    }
  }

  if (vendor.insuranceExpiryDate) {
    const coverageStatus = evaluateComplianceCoverage({
      endDate: vendor.insuranceExpiryDate,
      now,
      expiringWithinDays,
    });
    if (coverageStatus) {
      alerts.push(
        buildAlert({
          kind: "vendor_insurance_expiry",
          vendor,
          endDate: vendor.insuranceExpiryDate,
          coverageStatus,
          now,
          label: "Insurance / compliance certificate",
        }),
      );
    }
  }

  return alerts;
}

export function planSocietyComplianceAlerts(
  vendors: readonly VendorComplianceSnapshot[],
  now: Date,
  expiringWithinDays = AMC_COMPLIANCE_ALERT_DAYS,
): ComplianceAlertPlan[] {
  return vendors.flatMap((vendor) =>
    planVendorComplianceAlerts(vendor, now, expiringWithinDays),
  );
}

export function shouldOpenComplianceTicket(input: {
  alert: ComplianceAlertPlan;
  openSourceKeys: ReadonlySet<string>;
}): boolean {
  return !input.openSourceKeys.has(input.alert.dedupeKey);
}
