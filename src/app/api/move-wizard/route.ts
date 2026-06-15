import { getSession } from "@/lib/auth";
import {
  createMoveWizardDraft,
  getMoveWizardContext,
  listMoveWizardEvents,
} from "@/lib/move-wizard-service";
import { MOVE_WIZARD_TYPES, isCommitteeMoveApprover } from "@society/society-core";

const RESIDENT_ROLES = new Set(["member", "tenant"]);

export async function GET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isResident = RESIDENT_ROLES.has(session.role);
  const isCommittee = isCommitteeMoveApprover(session.role) || session.role === "treasurer";

  if (!isResident && !isCommittee) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [charges, events] = await Promise.all([
    getMoveWizardContext(session.societyId),
    listMoveWizardEvents({
      societyId: session.societyId,
      flatId: isResident && session.flatId ? session.flatId : undefined,
      initiatedBy: isResident ? session.userId : undefined,
    }),
  ]);

  const wizardEvents = events.filter((event) => event.workflowStatus !== "checklist");

  return Response.json({
    charges,
    events: wizardEvents,
    canCreate: isResident && Boolean(session.flatId),
    viewerRole: session.role,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.societyId || !RESIDENT_ROLES.has(session.role) || !session.flatId) {
    return Response.json({ error: "Flat-linked residents only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const type = typeof body.type === "string" ? body.type : "";
    const residentName = typeof body.residentName === "string" ? body.residentName : session.name;
    const residentType = typeof body.residentType === "string" ? body.residentType : "owner";
    const scheduledMoveDate = body.scheduledMoveDate ? new Date(body.scheduledMoveDate) : null;
    const notes = typeof body.notes === "string" ? body.notes : "";

    if (!MOVE_WIZARD_TYPES.includes(type as (typeof MOVE_WIZARD_TYPES)[number])) {
      return Response.json({ error: "Invalid move type" }, { status: 400 });
    }
    if (!scheduledMoveDate || Number.isNaN(scheduledMoveDate.getTime())) {
      return Response.json({ error: "Scheduled move date is required" }, { status: 400 });
    }

    const event = await createMoveWizardDraft({
      societyId: session.societyId,
      flatId: session.flatId,
      initiatedBy: session.userId,
      type: type as "move_in" | "move_out",
      residentName,
      residentType,
      scheduledMoveDate,
      notes,
    });

    return Response.json({ event }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create move request";
    return Response.json({ error: message }, { status: 400 });
  }
}
