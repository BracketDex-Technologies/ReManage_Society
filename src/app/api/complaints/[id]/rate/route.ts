import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { assertSatisfactionRating } from "@society/community-core";
import { isCommitteeRole } from "@/lib/roles";
import { filterComplaintsByScope, resolveComplaintListScope } from "@/lib/complaints/list-scope";
import { logUpdated } from "@/lib/activity-log";
import { broadcastNotification } from "@/lib/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const rating = assertSatisfactionRating(Number(body.rating));
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  const complaint = await prisma.complaint.findFirst({
    where: { id, societyId: session.societyId },
  });

  if (!complaint) {
    return Response.json({ error: "Complaint not found" }, { status: 404 });
  }

  if (complaint.status !== "resolved" && complaint.status !== "closed") {
    return Response.json(
      { error: "You can only rate complaints after they are resolved" },
      { status: 400 },
    );
  }

  if (complaint.satisfactionRating) {
    return Response.json({ error: "This complaint has already been rated" }, { status: 400 });
  }

  if (!isCommitteeRole(session.role)) {
    const scope = await resolveComplaintListScope(session);
    const [complaintScoped] = filterComplaintsByScope([complaint], scope);
    if (!complaintScoped) {
      return Response.json({ error: "You can only rate your own complaints" }, { status: 403 });
    }
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      satisfactionRating: rating,
      ...(comment ? { satisfactionComment: comment } : {}),
      status: "closed",
    },
  });

  await logUpdated("complaint", id, complaint.title, {
    action: "rated",
    rating,
    hasComment: Boolean(comment),
  });

  if (rating <= 2) {
    await broadcastNotification(
      session.societyId,
      "complaint_update",
      `Low satisfaction rating (${rating}/5)`,
      `${complaint.raisedBy} rated "${complaint.title}" ${rating}/5. Review may be needed.`,
      "/complaints",
    );
  }

  return Response.json({ complaint: updated });
}
