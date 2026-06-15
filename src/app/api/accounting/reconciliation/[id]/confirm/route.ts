import { getSession } from "@/lib/auth";
import { confirmBankReconciliationSession } from "@/lib/bank-reconciliation-service";

function isTreasurerRole(role: string) {
  return ["chairman", "secretary", "treasurer"].includes(role);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.societyId || !isTreasurerRole(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const detail = await confirmBankReconciliationSession({
      societyId: session.societyId,
      sessionId: id,
      confirmedBy: session.userId,
    });

    return Response.json({
      session: detail,
      message: `${detail.matchedLines} bank lines confirmed against ledger records`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm reconciliation";
    return Response.json({ error: message }, { status: 400 });
  }
}
