import { buildTenantRlsPolicySql } from "./rls-policy.ts";

export interface TenantRlsTable {
  tableName: string;
  societyColumn: string;
}

export const TENANT_RLS_TABLES: readonly TenantRlsTable[] = [
  { tableName: "MaintenanceBill", societyColumn: "societyId" },
  { tableName: "BillPaymentLink", societyColumn: "societyId" },
  { tableName: "BankReconciliationSession", societyColumn: "societyId" },
  { tableName: "BankStatementLine", societyColumn: "societyId" },
  { tableName: "MeterReadingImportSession", societyColumn: "societyId" },
  { tableName: "MeterReading", societyColumn: "societyId" },
  { tableName: "Invoice", societyColumn: "societyId" },
  { tableName: "Payment", societyColumn: "societyId" },
  { tableName: "Expense", societyColumn: "societyId" },
  { tableName: "SocietyNocRequest", societyColumn: "societyId" },
  { tableName: "MoveEvent", societyColumn: "societyId" },
  { tableName: "Complaint", societyColumn: "societyId" },
  { tableName: "Notice", societyColumn: "societyId" },
  { tableName: "Document", societyColumn: "societyId" },
  { tableName: "ActivityLog", societyColumn: "societyId" },
  { tableName: "Notification", societyColumn: "societyId" },
  { tableName: "Visitor", societyColumn: "societyId" },
  { tableName: "Package", societyColumn: "societyId" },
  { tableName: "UserSession", societyColumn: "societyId" },
  { tableName: "SecurityEvent", societyColumn: "societyId" },
];

export function buildTenantRlsManifestSql(): string {
  return TENANT_RLS_TABLES.map((table) => buildTenantRlsPolicySql(table)).join("\n\n");
}
