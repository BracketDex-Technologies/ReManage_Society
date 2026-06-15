import { getSession } from "@/lib/auth";
import { pdfFromDataUrl } from "@/lib/noc-pdf";
import { prisma } from "@/lib/prisma";

const RESIDENT_ROLES = new Set(["member", "tenant"]);
const COMMITTEE_ROLES = new Set(["chairman", "secretary", "treasurer"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const noc = await prisma.societyNocRequest.findFirst({
    where: { id, societyId: session.societyId },
  });

  if (!noc || !noc.pdfDataUrl) {
    return Response.json({ error: "NOC not found" }, { status: 404 });
  }

  const isOwner = noc.requestedBy === session.userId;
  const isCommittee = COMMITTEE_ROLES.has(session.role);
  const isSameFlat =
    RESIDENT_ROLES.has(session.role) && session.flatId && noc.flatId === session.flatId;

  if (!isOwner && !isCommittee && !isSameFlat) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = pdfFromDataUrl(noc.pdfDataUrl);
  if (!buffer) {
    return Response.json({ error: "PDF unavailable" }, { status: 500 });
  }

  const fileName = `${noc.certificateNo.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
