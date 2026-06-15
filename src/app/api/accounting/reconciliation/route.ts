import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import {
  createBankReconciliationSession,
  getBankReconciliationSession,
  rowsFromObjects,
} from "@/lib/bank-reconciliation-service";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import * as XLSX from "xlsx";

function isTreasurerRole(role: string) {
  return ["chairman", "secretary", "treasurer"].includes(role);
}

async function parseUploadFile(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length > 0) {
      throw new Error(parsed.errors[0]?.message || "Failed to parse CSV");
    }
    return rowsFromObjects(parsed.data);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("Excel file has no sheets");
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
    return rowsFromObjects(rows);
  }

  throw new Error("Upload a CSV or Excel bank statement");
}

export async function GET() {
  const session = await getSession();
  if (!session?.societyId || !isTreasurerRole(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.bankReconciliationSession.findMany({
    where: { societyId: session.societyId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      fileName: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      totalLines: true,
      matchedLines: true,
      createdAt: true,
      confirmedAt: true,
    },
  });

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
    if (!(file instanceof File)) {
      return Response.json({ error: "Bank statement file is required" }, { status: 400 });
    }

    const rawRows = await parseUploadFile(file);
    const result = await createBankReconciliationSession({
      societyId: session.societyId,
      createdBy: session.userId,
      fileName: file.name,
      rawRows,
    });

    const detail = await getBankReconciliationSession(session.societyId, result.session.id);

    return Response.json({
      session: detail,
      summary: result.summary,
      unmatchedBankRows: result.unmatchedBankRows,
      unusedCandidateIds: result.unusedCandidateIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload bank statement";
    return Response.json({ error: message }, { status: 400 });
  }
}
