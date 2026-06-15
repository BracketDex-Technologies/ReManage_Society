import { getSession } from "@/lib/auth";
import { pdfFromDataUrl } from "@/lib/gate-pass-pdf";
import { prisma } from "@/lib/prisma";
import { isCommitteeMoveApprover } from "@society/society-core";

const RESIDENT_ROLES = new Set(["member", "tenant"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const event = await prisma.moveEvent.findFirst({
    where: { id, societyId: session.societyId },
  });

  if (!event?.gatePassPdfDataUrl) {
    return Response.json({ error: "Gate pass not found" }, { status: 404 });
  }

  const isOwner = event.initiatedBy === session.userId;
  const isCommittee = isCommitteeMoveApprover(session.role);
  const isSameFlat =
    RESIDENT_ROLES.has(session.role) && session.flatId && event.flatId === session.flatId;

  if (!isOwner && !isCommittee && !isSameFlat) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = pdfFromDataUrl(event.gatePassPdfDataUrl);
  if (!buffer) {
    return Response.json({ error: "PDF unavailable" }, { status: 500 });
  }

  const fileName = `gate_pass_${event.gatePassCode || event.id}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
