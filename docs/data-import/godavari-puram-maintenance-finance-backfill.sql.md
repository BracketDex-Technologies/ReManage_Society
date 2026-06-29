# Godavari Puram Maintenance Finance Backfill

Use this after importing Godavari Puram maintenance bills directly into `MaintenanceBill`.

## Why This Exists

The old Excel import created `MaintenanceBill` rows directly. The dashboard now reads those bills all-time, but the app's newer finance layer also expects related records for app-raised billing:

- `Invoice`
- `InvoiceLineItem`
- `Payment`
- `Receipt`
- `FinancialTransaction`
- `LedgerEntry`

This SQL backfills those records for existing Godavari Puram maintenance bills so historical Excel bills look like app-created invoices in reports and accounting screens.

## Safety Notes

- Run this only after the Godavari society and maintenance bills exist.
- It targets `soc_godavari_puram`.
- It is idempotent for deterministic IDs, so re-running updates/keeps the same records.
- For historical paid bills with no payment method, it records payment method as `CASH` and posts to ledger account `1000` Cash. Change the `COALESCE(NULLIF(b."paidVia", ''), 'cash')` expression to `'upi'` or `'neft'` if you want those to post to bank account `1010`.
- Pending bills receive invoice ledger entries but no payment/receipt entries.

## SQL

```sql
BEGIN;

INSERT INTO "LedgerAccount" ("id", "societyId", "code", "name", "type", "isActive", "createdAt", "updatedAt")
SELECT 'ledger_gps_' || code, 'soc_godavari_puram', code, name, type, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('1000', 'Cash', 'ASSET'),
    ('1010', 'Bank', 'ASSET'),
    ('1100', 'Accounts Receivable', 'ASSET'),
    ('1200', 'Reserve Funds', 'ASSET'),
    ('2000', 'Vendor Payables', 'LIABILITY'),
    ('2100', 'Deposits', 'LIABILITY'),
    ('3000', 'Maintenance Income', 'INCOME'),
    ('3010', 'Parking Income', 'INCOME'),
    ('3020', 'Amenity Income', 'INCOME'),
    ('4000', 'Salaries', 'EXPENSE'),
    ('4010', 'Repairs', 'EXPENSE'),
    ('4020', 'Utilities', 'EXPENSE'),
    ('4030', 'Cleaning', 'EXPENSE')
) AS defaults(code, name, type)
ON CONFLICT ("societyId", "code") DO NOTHING;

WITH bill_source AS (
  SELECT
    b."id" AS bill_id,
    b."societyId" AS society_id,
    b."flatId" AS flat_id,
    b."amount",
    b."lateFee",
    b."gstAmount",
    COALESCE(b."totalAmount", b."amount" + b."lateFee" + b."gstAmount") AS total_amount,
    b."period",
    b."dueDate",
    b."status",
    COALESCE(b."paidAmount", 0) AS paid_amount,
    COALESCE(b."paidAt", (date_trunc('month', to_date(b."period" || '-01', 'YYYY-MM-DD')::timestamp) + interval '1 month - 1 day')::timestamp) AS paid_at,
    COALESCE(NULLIF(b."paidVia", ''), 'cash') AS paid_via,
    b."description",
    b."receiptNote",
    b."createdAt",
    f."flatNumber",
    u."id" AS unit_id
  FROM "MaintenanceBill" b
  JOIN "Flat" f ON f."id" = b."flatId"
  LEFT JOIN "Unit" u ON u."legacyFlatId" = f."id"
  WHERE b."societyId" = 'soc_godavari_puram'
),
invoice_source AS (
  SELECT
    *,
    'invoice_gps_' || bill_id AS invoice_id,
    'line_gps_' || bill_id AS line_item_id,
    'INV-GPS-' || replace(period, '-', '') || '-' || regexp_replace(flat_number, '[^A-Za-z0-9]+', '-', 'g') || '-' || right(bill_id, 6) AS invoice_number
  FROM bill_source
)
INSERT INTO "Invoice" (
  "id", "societyId", "unitId", "invoiceNumber", "period", "issueDate", "dueDate",
  "status", "subtotal", "taxAmount", "penaltyAmount", "discountAmount",
  "totalAmount", "paidAmount", "notes", "createdAt", "updatedAt"
)
SELECT
  invoice_id,
  society_id,
  unit_id,
  invoice_number,
  period,
  "createdAt",
  "dueDate",
  CASE
    WHEN status = 'paid' THEN 'PAID'
    WHEN status = 'partial' THEN 'PARTIAL'
    ELSE 'ISSUED'
  END,
  amount,
  "gstAmount",
  "lateFee",
  0,
  total_amount,
  paid_amount,
  COALESCE(description, 'Historical maintenance bill imported from Excel'),
  "createdAt",
  CURRENT_TIMESTAMP
FROM invoice_source
ON CONFLICT ("id") DO UPDATE SET
  "unitId" = EXCLUDED."unitId",
  "invoiceNumber" = EXCLUDED."invoiceNumber",
  "status" = EXCLUDED."status",
  "subtotal" = EXCLUDED."subtotal",
  "taxAmount" = EXCLUDED."taxAmount",
  "penaltyAmount" = EXCLUDED."penaltyAmount",
  "totalAmount" = EXCLUDED."totalAmount",
  "paidAmount" = EXCLUDED."paidAmount",
  "notes" = EXCLUDED."notes",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH bill_source AS (
  SELECT
    b."id" AS bill_id,
    b."amount",
    b."lateFee",
    b."gstAmount",
    COALESCE(b."totalAmount", b."amount" + b."lateFee" + b."gstAmount") AS total_amount,
    b."billType",
    b."description"
  FROM "MaintenanceBill" b
  WHERE b."societyId" = 'soc_godavari_puram'
)
INSERT INTO "InvoiceLineItem" (
  "id", "invoiceId", "description", "category", "quantity", "unitAmount",
  "taxAmount", "totalAmount", "metadata"
)
SELECT
  'line_gps_' || bill_id,
  'invoice_gps_' || bill_id,
  COALESCE(description, 'Historical maintenance bill imported from Excel'),
  "billType",
  1,
  amount,
  "gstAmount" + "lateFee",
  total_amount,
  '{"source":"godavari_excel_import"}'
FROM bill_source
ON CONFLICT ("id") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "unitAmount" = EXCLUDED."unitAmount",
  "taxAmount" = EXCLUDED."taxAmount",
  "totalAmount" = EXCLUDED."totalAmount",
  "metadata" = EXCLUDED."metadata";

UPDATE "MaintenanceBill" b
SET "invoiceId" = 'invoice_gps_' || b."id",
    "updatedAt" = CURRENT_TIMESTAMP
WHERE b."societyId" = 'soc_godavari_puram'
  AND COALESCE(b."invoiceId", '') <> 'invoice_gps_' || b."id";

WITH paid_bills AS (
  SELECT
    b."id" AS bill_id,
    b."societyId" AS society_id,
    COALESCE(b."paidAmount", 0) AS paid_amount,
    COALESCE(b."paidAt", (date_trunc('month', to_date(b."period" || '-01', 'YYYY-MM-DD')::timestamp) + interval '1 month - 1 day')::timestamp) AS paid_at,
    COALESCE(NULLIF(b."paidVia", ''), 'cash') AS paid_via,
    b."receiptNote",
    b."period",
    f."flatNumber"
  FROM "MaintenanceBill" b
  JOIN "Flat" f ON f."id" = b."flatId"
  WHERE b."societyId" = 'soc_godavari_puram'
    AND COALESCE(b."paidAmount", 0) > 0
)
INSERT INTO "Payment" (
  "id", "societyId", "invoiceId", "amount", "method", "reference", "status", "paidAt", "createdAt"
)
SELECT
  'payment_gps_' || bill_id,
  society_id,
  'invoice_gps_' || bill_id,
  paid_amount,
  upper(paid_via),
  COALESCE("receiptNote", 'Historical Excel maintenance payment for ' || period || ' / ' || "flatNumber"),
  'SUCCESS',
  paid_at,
  CURRENT_TIMESTAMP
FROM paid_bills
ON CONFLICT ("id") DO UPDATE SET
  "amount" = EXCLUDED."amount",
  "method" = EXCLUDED."method",
  "reference" = EXCLUDED."reference",
  "status" = 'SUCCESS',
  "paidAt" = EXCLUDED."paidAt";

WITH paid_bills AS (
  SELECT
    b."id" AS bill_id,
    b."societyId" AS society_id,
    COALESCE(b."paidAt", (date_trunc('month', to_date(b."period" || '-01', 'YYYY-MM-DD')::timestamp) + interval '1 month - 1 day')::timestamp) AS paid_at,
    b."receiptNote",
    b."period",
    f."flatNumber"
  FROM "MaintenanceBill" b
  JOIN "Flat" f ON f."id" = b."flatId"
  WHERE b."societyId" = 'soc_godavari_puram'
    AND COALESCE(b."paidAmount", 0) > 0
)
INSERT INTO "Receipt" ("id", "societyId", "paymentId", "receiptNumber", "issuedAt", "notes")
SELECT
  'receipt_gps_' || bill_id,
  society_id,
  'payment_gps_' || bill_id,
  'GODAVA2026-' || replace(period, '-', '') || '-' || regexp_replace("flatNumber", '[^A-Za-z0-9]+', '-', 'g') || '-' || right(bill_id, 6),
  paid_at,
  COALESCE("receiptNote", 'Historical Excel maintenance receipt')
FROM paid_bills
ON CONFLICT ("id") DO UPDATE SET
  "receiptNumber" = EXCLUDED."receiptNumber",
  "issuedAt" = EXCLUDED."issuedAt",
  "notes" = EXCLUDED."notes";

WITH bill_source AS (
  SELECT
    b."id" AS bill_id,
    b."societyId" AS society_id,
    COALESCE(b."totalAmount", b."amount" + b."lateFee" + b."gstAmount") AS total_amount,
    b."period",
    b."billType",
    b."createdAt"
  FROM "MaintenanceBill" b
  WHERE b."societyId" = 'soc_godavari_puram'
)
INSERT INTO "FinancialTransaction" (
  "id", "societyId", "sourceType", "sourceId", "description",
  "transactionDate", "createdBy", "createdAt"
)
SELECT
  'ft_invoice_gps_' || bill_id,
  society_id,
  'INVOICE',
  'invoice_gps_' || bill_id,
  'Invoice backfill for historical maintenance bill ' || period,
  "createdAt",
  'Godavari Puram Import',
  CURRENT_TIMESTAMP
FROM bill_source
ON CONFLICT ("id") DO UPDATE SET
  "description" = EXCLUDED."description",
  "transactionDate" = EXCLUDED."transactionDate",
  "createdBy" = EXCLUDED."createdBy";

WITH paid_bills AS (
  SELECT
    b."id" AS bill_id,
    b."societyId" AS society_id,
    COALESCE(b."paidAt", (date_trunc('month', to_date(b."period" || '-01', 'YYYY-MM-DD')::timestamp) + interval '1 month - 1 day')::timestamp) AS paid_at,
    b."period"
  FROM "MaintenanceBill" b
  WHERE b."societyId" = 'soc_godavari_puram'
    AND COALESCE(b."paidAmount", 0) > 0
)
INSERT INTO "FinancialTransaction" (
  "id", "societyId", "paymentId", "sourceType", "sourceId", "description",
  "transactionDate", "createdBy", "createdAt"
)
SELECT
  'ft_payment_gps_' || bill_id,
  society_id,
  'payment_gps_' || bill_id,
  'PAYMENT',
  'payment_gps_' || bill_id,
  'Payment backfill for historical maintenance bill ' || period,
  paid_at,
  'Godavari Puram Import',
  CURRENT_TIMESTAMP
FROM paid_bills
ON CONFLICT ("id") DO UPDATE SET
  "paymentId" = EXCLUDED."paymentId",
  "description" = EXCLUDED."description",
  "transactionDate" = EXCLUDED."transactionDate",
  "createdBy" = EXCLUDED."createdBy";

WITH bill_source AS (
  SELECT
    b."id" AS bill_id,
    b."societyId" AS society_id,
    COALESCE(b."totalAmount", b."amount" + b."lateFee" + b."gstAmount") AS total_amount,
    b."billType",
    b."createdAt"
  FROM "MaintenanceBill" b
  WHERE b."societyId" = 'soc_godavari_puram'
),
invoice_ledger_lines AS (
  SELECT bill_id, society_id, '1100' AS account_code, total_amount AS debit, 0::float AS credit, 'Accounts receivable' AS memo, 'debit' AS side, "createdAt" AS posted_at
  FROM bill_source
  UNION ALL
  SELECT bill_id, society_id, CASE WHEN "billType" = 'parking' THEN '3010' ELSE '3000' END, 0::float, total_amount, 'Maintenance income', 'credit', "createdAt"
  FROM bill_source
)
INSERT INTO "LedgerEntry" (
  "id", "societyId", "transactionId", "accountId", "invoiceId",
  "debit", "credit", "memo", "postedAt"
)
SELECT
  'le_invoice_gps_' || bill_id || '_' || side,
  society_id,
  'ft_invoice_gps_' || bill_id,
  la."id",
  'invoice_gps_' || bill_id,
  debit,
  credit,
  memo,
  posted_at
FROM invoice_ledger_lines
JOIN "LedgerAccount" la
  ON la."societyId" = invoice_ledger_lines.society_id
 AND la."code" = invoice_ledger_lines.account_code
ON CONFLICT ("id") DO UPDATE SET
  "transactionId" = EXCLUDED."transactionId",
  "accountId" = EXCLUDED."accountId",
  "invoiceId" = EXCLUDED."invoiceId",
  "debit" = EXCLUDED."debit",
  "credit" = EXCLUDED."credit",
  "memo" = EXCLUDED."memo",
  "postedAt" = EXCLUDED."postedAt";

WITH paid_bills AS (
  SELECT
    b."id" AS bill_id,
    b."societyId" AS society_id,
    COALESCE(b."paidAmount", 0) AS paid_amount,
    COALESCE(NULLIF(b."paidVia", ''), 'cash') AS paid_via,
    COALESCE(b."paidAt", (date_trunc('month', to_date(b."period" || '-01', 'YYYY-MM-DD')::timestamp) + interval '1 month - 1 day')::timestamp) AS paid_at
  FROM "MaintenanceBill" b
  WHERE b."societyId" = 'soc_godavari_puram'
    AND COALESCE(b."paidAmount", 0) > 0
),
payment_ledger_lines AS (
  SELECT
    bill_id,
    society_id,
    CASE WHEN lower(paid_via) = 'cash' THEN '1000' ELSE '1010' END AS account_code,
    paid_amount AS debit,
    0::float AS credit,
    'Manual payment received' AS memo,
    'debit' AS side,
    paid_at AS posted_at
  FROM paid_bills
  UNION ALL
  SELECT bill_id, society_id, '1100', 0::float, paid_amount, 'Accounts receivable settled', 'credit', paid_at
  FROM paid_bills
)
INSERT INTO "LedgerEntry" (
  "id", "societyId", "transactionId", "accountId", "invoiceId",
  "debit", "credit", "memo", "postedAt"
)
SELECT
  'le_payment_gps_' || bill_id || '_' || side,
  society_id,
  'ft_payment_gps_' || bill_id,
  la."id",
  'invoice_gps_' || bill_id,
  debit,
  credit,
  memo,
  posted_at
FROM payment_ledger_lines
JOIN "LedgerAccount" la
  ON la."societyId" = payment_ledger_lines.society_id
 AND la."code" = payment_ledger_lines.account_code
ON CONFLICT ("id") DO UPDATE SET
  "transactionId" = EXCLUDED."transactionId",
  "accountId" = EXCLUDED."accountId",
  "invoiceId" = EXCLUDED."invoiceId",
  "debit" = EXCLUDED."debit",
  "credit" = EXCLUDED."credit",
  "memo" = EXCLUDED."memo",
  "postedAt" = EXCLUDED."postedAt";

COMMIT;
```

## Post-Backfill Checks

```sql
SELECT
  COUNT(*) AS bills,
  COUNT("invoiceId") AS bills_linked_to_invoice,
  SUM(COALESCE("paidAmount", 0)) AS maintenance_paid_amount
FROM "MaintenanceBill"
WHERE "societyId" = 'soc_godavari_puram';

SELECT COUNT(*) AS invoices
FROM "Invoice"
WHERE "societyId" = 'soc_godavari_puram'
  AND "id" LIKE 'invoice_gps_%';

SELECT COUNT(*) AS payments, SUM("amount") AS payment_total
FROM "Payment"
WHERE "societyId" = 'soc_godavari_puram'
  AND "id" LIKE 'payment_gps_%';

SELECT
  SUM("debit") AS ledger_debit,
  SUM("credit") AS ledger_credit
FROM "LedgerEntry"
WHERE "societyId" = 'soc_godavari_puram'
  AND ("id" LIKE 'le_invoice_gps_%' OR "id" LIKE 'le_payment_gps_%');

SELECT
  SUM(COALESCE("paidAmount", 0)) AS dashboard_collected,
  SUM(COALESCE("totalAmount", "amount" + "lateFee" + "gstAmount") - COALESCE("paidAmount", 0)) AS dashboard_pending
FROM "MaintenanceBill"
WHERE "societyId" = 'soc_godavari_puram';
```
