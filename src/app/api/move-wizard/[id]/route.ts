import { getSession } from "@/lib/auth";
import { validateDocumentProof } from "@/lib/document-proof";
import {
  approveMoveWizard,
  payMoveWizardShifting,
  rejectMoveWizard,
  submitMoveWizardForApproval,
  updateMoveWizardDraft,
} from "@/lib/move-wizard-service";
import { isCommitteeMoveApprover } from "@society/society-core";

const RESIDENT_ROLES = new Set(["member", "tenant"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "update_draft") {
      if (!RESIDENT_ROLES.has(session.role) || !session.flatId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      const policeProof = body.policeVerification
        ? validateDocumentProof({
            dataUrl: body.policeVerification.dataUrl,
            fileName: body.policeVerification.fileName,
            fileType: body.policeVerification.fileType,
          })
        : null;
      const leaseProof = body.leaseAgreement
        ? validateDocumentProof({
            dataUrl: body.leaseAgreement.dataUrl,
            fileName: body.leaseAgreement.fileName,
            fileType: body.leaseAgreement.fileType,
          })
        : null;

      const event = await updateMoveWizardDraft({
        eventId: id,
        societyId: session.societyId,
        flatId: session.flatId,
        ...(body.scheduledMoveDate ? { scheduledMoveDate: new Date(body.scheduledMoveDate) } : {}),
        ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
        ...(typeof body.residentName === "string" ? { residentName: body.residentName } : {}),
        ...(policeProof
          ? {
              policeVerification: {
                dataUrl: policeProof.dataUrl,
                fileName: policeProof.fileName,
                fileType: policeProof.fileType,
              },
            }
          : {}),
        ...(leaseProof
          ? {
              leaseAgreement: {
                dataUrl: leaseProof.dataUrl,
                fileName: leaseProof.fileName,
                fileType: leaseProof.fileType,
              },
            }
          : {}),
      });

      return Response.json({ event });
    }

    if (action === "pay_shifting") {
      if (!RESIDENT_ROLES.has(session.role) || !session.flatId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      const event = await payMoveWizardShifting({
        eventId: id,
        societyId: session.societyId,
        flatId: session.flatId,
        paymentRef: typeof body.utrNumber === "string" ? body.utrNumber : undefined,
        paidVia: typeof body.paidVia === "string" ? body.paidVia : "upi",
      });

      return Response.json({ event, message: "Shifting charge recorded" });
    }

    if (action === "submit") {
      if (!RESIDENT_ROLES.has(session.role) || !session.flatId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      const event = await submitMoveWizardForApproval({
        eventId: id,
        societyId: session.societyId,
        flatId: session.flatId,
      });

      return Response.json({ event, message: "Submitted for manager approval" });
    }

    if (action === "approve") {
      if (!isCommitteeMoveApprover(session.role)) {
        return Response.json({ error: "Secretary approval required" }, { status: 403 });
      }

      const event = await approveMoveWizard({
        eventId: id,
        societyId: session.societyId,
        approvedBy: session.name || session.email || session.role,
      });

      return Response.json({ event, message: "Approved — gate pass issued" });
    }

    if (action === "reject") {
      if (!isCommitteeMoveApprover(session.role)) {
        return Response.json({ error: "Secretary approval required" }, { status: 403 });
      }

      const event = await rejectMoveWizard({
        eventId: id,
        societyId: session.societyId,
        rejectedBy: session.name || session.email || session.role,
        reason: typeof body.reason === "string" ? body.reason : "",
      });

      return Response.json({ event, message: "Move request rejected" });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
