import { getSession } from "@/lib/auth";
import { scanVendorComplianceAlerts } from "@/lib/amc-compliance-service";
import { NextRequest } from "next/server";

export async function POST(_request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await scanVendorComplianceAlerts({ societyId: session.societyId });
    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json({ error: "Compliance scan failed" }, { status: 500 });
  }
}
