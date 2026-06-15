import {
  MOVE_WIZARD_STATUS,
  assertCanApproveMoveWizard,
  assertCanRejectMoveWizard,
  assertCanSubmitMoveWizard,
  buildMoveWizardChecklist,
  generateGatePassCode,
  markChecklistItemCompleted,
  shiftingChargeForMoveType,
  type MoveWizardType,
} from "@society/society-core";
import { pdfToDataUrl, renderGatePassPdf } from "@/lib/gate-pass-pdf";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const moveEventInclude = {
  flat: { select: { flatNumber: true, wing: true, ownerName: true } },
  society: {
    select: {
      name: true,
      address: true,
      city: true,
      pincode: true,
      moveInShiftingCharge: true,
      moveOutShiftingCharge: true,
    },
  },
} as const;

export async function getMoveWizardContext(societyId: string) {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: {
      moveInShiftingCharge: true,
      moveOutShiftingCharge: true,
    },
  });
  if (!society) throw new Error("Society not found");
  return society;
}

export async function listMoveWizardEvents(input: {
  societyId: string;
  flatId?: string;
  initiatedBy?: string;
}) {
  return prisma.moveEvent.findMany({
    where: {
      societyId: input.societyId,
      ...(input.flatId ? { flatId: input.flatId } : {}),
      ...(input.initiatedBy ? { initiatedBy: input.initiatedBy } : {}),
    },
    include: moveEventInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function createMoveWizardDraft(input: {
  societyId: string;
  flatId: string;
  initiatedBy: string;
  type: MoveWizardType;
  residentName: string;
  residentType: string;
  scheduledMoveDate: Date;
  notes?: string | null;
}) {
  const society = await prisma.society.findUnique({
    where: { id: input.societyId },
    select: { moveInShiftingCharge: true, moveOutShiftingCharge: true },
  });
  if (!society) throw new Error("Society not found");

  const shiftingChargeAmount = shiftingChargeForMoveType(input.type, society);
  const checklist = buildMoveWizardChecklist(input.type);

  return prisma.moveEvent.create({
    data: {
      societyId: input.societyId,
      flatId: input.flatId,
      type: input.type,
      residentName: input.residentName.trim(),
      residentType: input.residentType,
      initiatedBy: input.initiatedBy,
      notes: input.notes?.trim() || null,
      scheduledMoveDate: input.scheduledMoveDate,
      workflowStatus: MOVE_WIZARD_STATUS.DRAFT,
      status: "initiated",
      checklist: JSON.stringify(checklist),
      shiftingChargeAmount,
      shiftingChargePaid: shiftingChargeAmount <= 0,
    },
    include: moveEventInclude,
  });
}

export async function updateMoveWizardDraft(input: {
  eventId: string;
  societyId: string;
  flatId: string;
  policeVerification?: { dataUrl: string; fileName: string; fileType: string } | null;
  leaseAgreement?: { dataUrl: string; fileName: string; fileType: string } | null;
  scheduledMoveDate?: Date;
  notes?: string | null;
  residentName?: string;
}) {
  const event = await prisma.moveEvent.findFirst({
    where: {
      id: input.eventId,
      societyId: input.societyId,
      flatId: input.flatId,
      workflowStatus: MOVE_WIZARD_STATUS.DRAFT,
    },
  });
  if (!event) throw new Error("Draft move request not found");

  return prisma.moveEvent.update({
    where: { id: event.id },
    data: {
      ...(input.scheduledMoveDate ? { scheduledMoveDate: input.scheduledMoveDate } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.residentName ? { residentName: input.residentName.trim() } : {}),
      ...(input.policeVerification
        ? {
            policeVerificationDataUrl: input.policeVerification.dataUrl,
            policeVerificationFileName: input.policeVerification.fileName,
            policeVerificationFileType: input.policeVerification.fileType,
          }
        : {}),
      ...(input.leaseAgreement
        ? {
            leaseAgreementDataUrl: input.leaseAgreement.dataUrl,
            leaseAgreementFileName: input.leaseAgreement.fileName,
            leaseAgreementFileType: input.leaseAgreement.fileType,
          }
        : {}),
    },
    include: moveEventInclude,
  });
}

export async function payMoveWizardShifting(input: {
  eventId: string;
  societyId: string;
  flatId: string;
  paymentRef?: string;
  paidVia?: string;
}) {
  const event = await prisma.moveEvent.findFirst({
    where: {
      id: input.eventId,
      societyId: input.societyId,
      flatId: input.flatId,
      workflowStatus: MOVE_WIZARD_STATUS.DRAFT,
    },
  });
  if (!event) throw new Error("Draft move request not found");
  if (event.shiftingChargeAmount <= 0 || event.shiftingChargePaid) {
    return prisma.moveEvent.findFirst({
      where: { id: event.id },
      include: moveEventInclude,
    });
  }

  let checklist = event.checklist;
  checklist = markChecklistItemCompleted(checklist, "Shifting charges", "Resident");

  return prisma.moveEvent.update({
    where: { id: event.id },
    data: {
      shiftingChargePaid: true,
      shiftingChargePaidAt: new Date(),
      shiftingPaymentRef: input.paymentRef?.trim() || input.paidVia || "upi",
      checklist,
    },
    include: moveEventInclude,
  });
}

export async function submitMoveWizardForApproval(input: {
  eventId: string;
  societyId: string;
  flatId: string;
}) {
  const event = await prisma.moveEvent.findFirst({
    where: {
      id: input.eventId,
      societyId: input.societyId,
      flatId: input.flatId,
      workflowStatus: MOVE_WIZARD_STATUS.DRAFT,
    },
  });
  if (!event) throw new Error("Draft move request not found");

  assertCanSubmitMoveWizard(event);

  const updated = await prisma.moveEvent.update({
    where: { id: event.id },
    data: {
      workflowStatus: MOVE_WIZARD_STATUS.PENDING_APPROVAL,
      submittedAt: new Date(),
      status: "in_progress",
    },
    include: moveEventInclude,
  });

  const committeeUsers = await prisma.user.findMany({
    where: { societyId: input.societyId, role: { in: ["chairman", "secretary"] } },
    select: { id: true },
  });
  await Promise.all(
    committeeUsers.map((user) =>
      createNotification({
        societyId: input.societyId,
        userId: user.id,
        type: "move_wizard",
        title: "Move request awaiting approval",
        message: `${updated.residentName} submitted a ${updated.type === "move_in" ? "move-in" : "move-out"} request for flat ${updated.flat.flatNumber}.`,
        link: "/move-events",
      }),
    ),
  );

  return updated;
}

async function issueGatePass(eventId: string, approvedBy: string) {
  const event = await prisma.moveEvent.findUnique({
    where: { id: eventId },
    include: moveEventInclude,
  });
  if (!event || !event.scheduledMoveDate) throw new Error("Move event not found");

  const gatePassCode = generateGatePassCode();
  const issuedAt = new Date();
  const pdfBytes = await renderGatePassPdf({
    societyName: event.society.name,
    societyAddress: `${event.society.address}, ${event.society.city} - ${event.society.pincode}`,
    flatNumber: event.flat.flatNumber,
    wing: event.flat.wing,
    residentName: event.residentName,
    moveType: event.type,
    gatePassCode,
    scheduledMoveDate: event.scheduledMoveDate,
    issuedAt,
  });

  let checklist = event.checklist;
  if (event.policeVerificationDataUrl) {
    checklist = markChecklistItemCompleted(checklist, "Police verification", approvedBy);
  }
  checklist = markChecklistItemCompleted(checklist, "Manager approved", approvedBy);
  if (event.shiftingChargePaid) {
    checklist = markChecklistItemCompleted(checklist, "Shifting charges", approvedBy);
  }

  return prisma.moveEvent.update({
    where: { id: event.id },
    data: {
      workflowStatus: MOVE_WIZARD_STATUS.APPROVED,
      approvedBy,
      gatePassCode,
      gatePassIssuedAt: issuedAt,
      gatePassPdfDataUrl: pdfToDataUrl(pdfBytes),
      checklist,
      status: "in_progress",
    },
    include: moveEventInclude,
  });
}

export async function approveMoveWizard(input: {
  eventId: string;
  societyId: string;
  approvedBy: string;
}) {
  const event = await prisma.moveEvent.findFirst({
    where: { id: input.eventId, societyId: input.societyId },
  });
  if (!event) throw new Error("Move request not found");

  assertCanApproveMoveWizard(event);

  const updated = await issueGatePass(event.id, input.approvedBy);

  const requester = await prisma.user.findUnique({
    where: { id: updated.initiatedBy },
    select: { id: true },
  });
  if (requester) {
    await createNotification({
      societyId: input.societyId,
      userId: requester.id,
      type: "move_wizard",
      title: "Gate pass issued",
      message: `Your ${updated.type === "move_in" ? "move-in" : "move-out"} gate pass is ready. Code: ${updated.gatePassCode}`,
      link: "/move-wizard",
    });
  }

  return updated;
}

export async function rejectMoveWizard(input: {
  eventId: string;
  societyId: string;
  rejectedBy: string;
  reason?: string;
}) {
  const event = await prisma.moveEvent.findFirst({
    where: { id: input.eventId, societyId: input.societyId },
  });
  if (!event) throw new Error("Move request not found");

  assertCanRejectMoveWizard(event);

  return prisma.moveEvent.update({
    where: { id: event.id },
    data: {
      workflowStatus: MOVE_WIZARD_STATUS.REJECTED,
      rejectedReason: input.reason?.trim() || null,
      status: "cancelled",
    },
    include: moveEventInclude,
  });
}
