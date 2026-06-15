import { getSession } from "@/lib/auth";
import { buildAuditorExportZip } from "@/lib/auditor-export-service";
import { currentIndianFiscalYear } from "@society/finance-core";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const fiscalYear = url.searchParams.get("year") || currentIndianFiscalYear();

    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;

    if (from && Number.isNaN(from.getTime())) {
      return Response.json({ error: "Invalid from date" }, { status: 400 });
    }
    if (to && Number.isNaN(to.getTime())) {
      return Response.json({ error: "Invalid to date" }, { status: 400 });
    }
    if ((from && !to) || (!from && to)) {
      return Response.json({ error: "Provide both from and to dates, or use fiscal year only" }, { status: 400 });
    }

    const exportedBy = session.name || session.email || session.role;
    const result = await buildAuditorExportZip({
      societyId: session.societyId,
      exportedBy,
      from,
      to,
      fiscalYear: from && to ? undefined : fiscalYear,
    });

    return new Response(new Uint8Array(result.zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate auditor export";
    return Response.json({ error: message }, { status: 500 });
  }
}
