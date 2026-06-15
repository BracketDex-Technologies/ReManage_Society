import { getSession } from "@/lib/auth";
import { listMeterReadingSessions, previewMeterReadingImport } from "@/lib/meter-reading-service";
import {
  isTreasurerRole,
  normalizeMeterTypeInput,
  normalizePeriodInput,
  parseSpreadsheetUpload,
} from "@/lib/spreadsheet-upload";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId || !isTreasurerRole(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = request.nextUrl.searchParams.get("period") || undefined;
  const sessions = await listMeterReadingSessions(session.societyId, period);
  return Response.json({ sessions });
}

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

    const preview = await previewMeterReadingImport({
      societyId: session.societyId,
      period,
      meterType,
      rawRows,
    });

    return Response.json({
      ok: true,
      fileName: file.name,
      preview,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 400 },
    );
  }
}
