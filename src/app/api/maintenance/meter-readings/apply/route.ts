import { getSession } from "@/lib/auth";
import { applyMeterReadingImport } from "@/lib/meter-reading-service";
import {
  isTreasurerRole,
  normalizeMeterTypeInput,
  normalizePeriodInput,
  parseSpreadsheetUpload,
} from "@/lib/spreadsheet-upload";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId || !isTreasurerRole(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const period = normalizePeriodInput(String(formData.get("period") || ""));
    const meterType = normalizeMeterTypeInput(String(formData.get("meterType") || "water"));

    if (!(file instanceof File)) {
      return Response.json({ error: "Upload a CSV or Excel file" }, { status: 400 });
    }

    const rawRows = await parseSpreadsheetUpload(file);
    if (rawRows.length === 0) {
      return Response.json({ error: "No meter readings found in file" }, { status: 400 });
    }

    const result = await applyMeterReadingImport({
      societyId: session.societyId,
      period,
      meterType,
      fileName: file.name,
      importedBy: session.userId,
      rawRows,
    });

    return Response.json({
      ok: true,
      session: result.session,
      summary: result.preview.summary,
      results: result.results,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 },
    );
  }
}
