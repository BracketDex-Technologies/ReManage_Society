import { getSession } from "@/lib/auth";
import {
  getFlatNocEligibility,
  listSocietyNocRequests,
  requestSocietyNoc,
} from "@/lib/noc-service";
import { NOC_PURPOSES } from "@society/operations-core";
import { logCreated } from "@/lib/activity-log";

const RESIDENT_ROLES = new Set(["member", "tenant"]);
const COMMITTEE_ROLES = new Set(["chairman", "secretary", "treasurer"]);

export async function GET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isCommittee = COMMITTEE_ROLES.has(session.role);
  const isResident = RESIDENT_ROLES.has(session.role);

  if (!isCommittee && !isResident) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let eligibility = null;
  if (session.flatId && isResident) {
    eligibility = await getFlatNocEligibility(session.societyId, session.flatId);
  }

  const requests = await listSocietyNocRequests({
    societyId: session.societyId,
    requestedBy: isResident ? session.userId : undefined,
    flatId: isResident && session.flatId ? session.flatId : undefined,
    limit: isCommittee ? 100 : 20,
  });

  return Response.json({
    purposes: NOC_PURPOSES,
    eligibility,
    requests,
    viewerRole: session.role,
    canRequest: isResident && Boolean(session.flatId),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.societyId || !RESIDENT_ROLES.has(session.role)) {
    return Response.json({ error: "Residents only" }, { status: 403 });
  }
  if (!session.flatId) {
    return Response.json({ error: "Your account is not linked to a flat" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const purpose = typeof body.purpose === "string" ? body.purpose : "";
    const notes = typeof body.notes === "string" ? body.notes : "";

    if (!purpose) {
      return Response.json({ error: "NOC purpose is required" }, { status: 400 });
    }

    const result = await requestSocietyNoc({
      societyId: session.societyId,
      flatId: session.flatId,
      requestedBy: session.userId,
      requesterName: session.name || session.email,
      purpose,
      notes,
    });

    if (!result.issued) {
      return Response.json(
        {
          issued: false,
          eligibility: result.eligibility,
          message: result.eligibility.message,
        },
        { status: 402 },
      );
    }

    await logCreated("noc", result.noc!.id, `NOC ${result.noc!.certificateNo}`, {
      purpose,
      flatId: session.flatId,
      reused: result.reused,
    });

    return Response.json({
      issued: true,
      reused: result.reused,
      message: result.reused
        ? "An active NOC for this purpose already exists"
        : "NOC generated successfully",
      noc: result.noc,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate NOC";
    return Response.json({ error: message }, { status: 400 });
  }
}
