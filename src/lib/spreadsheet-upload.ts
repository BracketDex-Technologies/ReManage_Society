import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  type RawMeterRow,
  type MeterType,
} from "@society/finance-core";

export function rowsFromObjects(rows: Record<string, string>[]): RawMeterRow[] {
  return rows
    .map((values, index) => ({ rowIndex: index + 1, values }))
    .filter((row) => Object.values(row.values).some((value) => String(value ?? "").trim()));
}

export async function parseSpreadsheetUpload(file: File): Promise<RawMeterRow[]> {
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

  throw new Error("Upload a CSV or Excel file");
}

export function isTreasurerRole(role: string) {
  return ["chairman", "secretary", "treasurer"].includes(role);
}

export function normalizePeriodInput(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    throw new Error("Period must be in YYYY-MM format");
  }
  return trimmed;
}

export function normalizeMeterTypeInput(value: string): MeterType {
  const normalized = value.trim().toLowerCase();
  if (normalized === "water") return "water";
  if (normalized === "electricity_grid" || normalized === "grid") return "electricity_grid";
  if (normalized === "electricity_dg" || normalized === "dg") return "electricity_dg";
  if (normalized === "gas") return "gas";
  throw new Error("Unsupported meter type");
}
