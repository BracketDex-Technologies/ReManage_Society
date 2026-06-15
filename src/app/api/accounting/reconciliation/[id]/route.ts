import { getSession } from "@/lib/auth";
import { getBankReconciliationSession } from "@/lib/bank-reconciliation-service";

function isTreasurerRole(role: string) {
  return ["chairman", "secretary", "treasurer"].includes(role);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.societyId || !isTreasurerRole(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const detail = await getBankReconciliationSession(session.societyId, id);
    return Response.json({ session: detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session not found";
    return Response.json({ error: message }, { status: 404 });
  }
}
