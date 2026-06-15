import {
  complianceAlertDedupeKey,
  planSocietyComplianceAlerts,
  shouldOpenComplianceTicket,
  type ComplianceAlertPlan,
} from "@society/operations-core";
import { logCreated } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const OPEN_COMPLAINT_STATUSES = ["open", "in_progress"] as const;

export interface ComplianceScanResult {
  scannedVendors: number;
  alertsPlanned: number;
  ticketsCreated: number;
  ticketsSkipped: number;
  createdComplaintIds: string[];
}

async function findComplianceAssignee(societyId: string) {
  const secretary = await prisma.user.findFirst({
    where: { societyId, role: "secretary" },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (secretary) return secretary;

  return prisma.user.findFirst({
    where: { societyId, role: "chairman" },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

async function loadOpenComplianceSourceKeys(societyId: string) {
  const open = await prisma.complaint.findMany({
    where: {
      societyId,
      sourceType: { in: ["vendor_amc_expiry", "vendor_insurance_expiry"] },
      sourceId: { not: null },
      status: { in: [...OPEN_COMPLAINT_STATUSES] },
    },
    select: { sourceType: true, sourceId: true },
  });

  return new Set(
    open
      .filter((row) => row.sourceType && row.sourceId)
      .map((row) =>
        complianceAlertDedupeKey(
          row.sourceType as "vendor_amc_expiry" | "vendor_insurance_expiry",
          row.sourceId!,
        ),
      ),
  );
}

async function createComplianceTicket(input: {
  societyId: string;
  alert: ComplianceAlertPlan;
  assigneeUserId: string;
}) {
  const complaint = await prisma.complaint.create({
    data: {
      societyId: input.societyId,
      flatNumber: "COMMITTEE",
      raisedBy: "ReManage Compliance",
      title: input.alert.title,
      description: input.alert.description,
      category: input.alert.complaintCategory,
      priority: input.alert.priority,
      status: "open",
      assignedTo: input.assigneeUserId,
      assignedAt: new Date(),
      slaHours: 168,
      escalationLevel: 1,
      sourceType: input.alert.kind,
      sourceId: input.alert.vendorId,
    },
  });

  await logCreated("complaint", complaint.id, input.alert.title, {
    sourceType: input.alert.kind,
    vendorId: input.alert.vendorId,
    automated: true,
  });

  await createNotification({
    societyId: input.societyId,
    userId: input.assigneeUserId,
    type: "compliance_alert",
    title: input.alert.title,
    message: input.alert.description,
    link: "/complaints",
  });

  return complaint;
}

export async function scanVendorComplianceAlerts(input: {
  societyId: string;
  now?: Date;
}): Promise<ComplianceScanResult> {
  const now = input.now ?? new Date();
  const vendors = await prisma.vendor.findMany({
    where: { societyId: input.societyId },
    select: {
      id: true,
      name: true,
      category: true,
      hasAMC: true,
      amcEndDate: true,
      insuranceExpiryDate: true,
    },
    orderBy: { name: "asc" },
  });

  const alerts = planSocietyComplianceAlerts(vendors, now);
  if (alerts.length === 0) {
    return {
      scannedVendors: vendors.length,
      alertsPlanned: 0,
      ticketsCreated: 0,
      ticketsSkipped: 0,
      createdComplaintIds: [],
    };
  }

  const openSourceKeys = await loadOpenComplianceSourceKeys(input.societyId);
  const assignee = await findComplianceAssignee(input.societyId);

  const createdComplaintIds: string[] = [];
  let ticketsCreated = 0;
  let ticketsSkipped = 0;

  for (const alert of alerts) {
    if (!shouldOpenComplianceTicket({ alert, openSourceKeys })) {
      ticketsSkipped += 1;
      continue;
    }

    if (!assignee) {
      ticketsSkipped += 1;
      continue;
    }

    const complaint = await createComplianceTicket({
      societyId: input.societyId,
      alert,
      assigneeUserId: assignee.id,
    });

    openSourceKeys.add(alert.dedupeKey);
    createdComplaintIds.push(complaint.id);
    ticketsCreated += 1;
  }

  return {
    scannedVendors: vendors.length,
    alertsPlanned: alerts.length,
    ticketsCreated,
    ticketsSkipped,
    createdComplaintIds,
  };
}

export async function getVendorComplianceSummary(societyId: string, now = new Date()) {
  const vendors = await prisma.vendor.findMany({
    where: { societyId },
    select: {
      id: true,
      name: true,
      category: true,
      hasAMC: true,
      amcEndDate: true,
      insuranceExpiryDate: true,
    },
    orderBy: { name: "asc" },
  });

  const alerts = planSocietyComplianceAlerts(vendors, now);
  const openSourceKeys = await loadOpenComplianceSourceKeys(societyId);

  return {
    vendors,
    alerts: alerts.map((alert) => ({
      ...alert,
      endDate: alert.endDate.toISOString(),
      hasOpenTicket: openSourceKeys.has(alert.dedupeKey),
    })),
  };
}
