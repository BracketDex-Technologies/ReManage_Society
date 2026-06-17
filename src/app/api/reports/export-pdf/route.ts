import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import {
  buildReportPdfFilename,
  buildReportPeriodLabel,
  renderReportPdf,
  type ReportPdfInput,
  type ReportPdfType,
} from "@/lib/report-pdf";

function isReportType(value: unknown): value is ReportPdfType {
  return value === "monthly" || value === "annual" || value === "financial";
}

export async function POST(request: NextRequest) {
  const { error, status, session } = await requireAdmin();
  if (error || !session?.societyId) {
    return Response.json({ error: error || "Unauthorized" }, { status: status || 401 });
  }

  try {
    const body = await request.json();
    const type = body?.type;
    const period = typeof body?.period === "string" ? body.period : "";
    const data = body?.data;

    if (!isReportType(type) || !period || !data || typeof data !== "object") {
      return Response.json({ error: "Invalid export payload" }, { status: 400 });
    }

    const society = await prisma.society.findUnique({
      where: { id: session.societyId },
      select: { name: true },
    });

    const input: ReportPdfInput = {
      societyName: society?.name || "Society",
      type,
      periodLabel: buildReportPeriodLabel(type, period),
      generatedAt: new Date(),
    };

    if (type === "monthly") input.monthly = data;
    if (type === "annual") input.annual = data;
    if (type === "financial") input.financial = data;

    const bytes = await renderReportPdf(input);
    const fileName = buildReportPdfFilename(type, period);

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (exportError) {
    console.error("Report PDF export error:", exportError);
    return Response.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
