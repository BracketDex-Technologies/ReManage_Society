# Godavari Puram Monthly Expenses SQL Import

Generated for the monthly expense figures shared on 2026-06-29.

## What This Data Means

The figures are a monthly expense baseline with old and revised amounts:

| Expense | Old Amount | Revised Amount |
|---|---:|---:|
| Sweeper | 8,000 | 10,000 |
| Housekeeping material | 1,500 | 1,500 |
| Security Charges | 18,000 | 32,000 |
| Electricity Bill | 45,000 | 45,000 |
| Water Bill | 5,000 | 5,000 |
| Other | 3,000 | 3,000 |
| Total | 80,500 | 96,500 |

This SQL inserts the revised monthly amount total of `96,500` into the app's `Expense` table for Godavari Puram and also creates matching journal/ledger records.

## Safety Notes

- This uses society id `soc_godavari_puram` from the Godavari resident import SQL.
- `paidOn` is set to `2026-06-01` so these expenses appear in the June 2026 expense period. Change `expense_month` before running if needed.
- The app does not have a recurring expense schedule table. These are one month's actual approved expenses, not an automatic recurring rule.
- The SQL is idempotent for these deterministic IDs. Re-running updates the same six expenses and ledger records instead of adding another copy.
- It creates ledger entries directly. Run on staging/backup first, then check Expenses, Financial Reports, and Trial Balance.

## Category Mapping

| Expense | App Category | Ledger Account |
|---|---|---|
| Sweeper | `housekeeping_salary` | `4000` Salaries |
| Housekeeping material | `housekeeping` | `4030` Cleaning |
| Security Charges | `security_salary` | `4000` Salaries |
| Electricity Bill | `electricity_common_area` | `4020` Utilities |
| Water Bill | `water_bill` | `4020` Utilities |
| Other | `other` | `4010` Repairs / general expense |

## SQL

```sql
BEGIN;

WITH import_context AS (
  SELECT
    'soc_godavari_puram'::text AS society_id,
    'user_gps_chairman'::text AS actor_user_id,
    'Godavari Puram Import'::text AS actor_name,
    DATE '2026-06-01' AS expense_month
),
expense_source(line_no, slug, title, old_amount, revised_amount, category, paid_to, account_code) AS (
  VALUES
    (1, 'sweeper', 'Sweeper', 8000, 10000, 'housekeeping_salary', 'Sweeper', '4000'),
    (2, 'housekeeping_material', 'Housekeeping material', 1500, 1500, 'housekeeping', 'Housekeeping material vendor', '4030'),
    (3, 'security_charges', 'Security Charges', 18000, 32000, 'security_salary', 'Security agency', '4000'),
    (4, 'electricity_bill', 'Electricity Bill', 45000, 45000, 'electricity_common_area', 'Electricity provider', '4020'),
    (5, 'water_bill', 'Water Bill', 5000, 5000, 'water_bill', 'Water provider', '4020'),
    (6, 'other', 'Other', 3000, 3000, 'other', NULL, '4010')
)
INSERT INTO "LedgerAccount" ("id", "societyId", "code", "name", "type", "isActive", "createdAt", "updatedAt")
SELECT 'ledger_gps_' || code, society_id, code, name, type, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM import_context
CROSS JOIN (
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

WITH import_context AS (
  SELECT
    'soc_godavari_puram'::text AS society_id,
    'user_gps_chairman'::text AS actor_user_id,
    'Godavari Puram Import'::text AS actor_name,
    DATE '2026-06-01' AS expense_month
),
expense_source(line_no, slug, title, old_amount, revised_amount, category, paid_to, account_code) AS (
  VALUES
    (1, 'sweeper', 'Sweeper', 8000, 10000, 'housekeeping_salary', 'Sweeper', '4000'),
    (2, 'housekeeping_material', 'Housekeeping material', 1500, 1500, 'housekeeping', 'Housekeeping material vendor', '4030'),
    (3, 'security_charges', 'Security Charges', 18000, 32000, 'security_salary', 'Security agency', '4000'),
    (4, 'electricity_bill', 'Electricity Bill', 45000, 45000, 'electricity_common_area', 'Electricity provider', '4020'),
    (5, 'water_bill', 'Water Bill', 5000, 5000, 'water_bill', 'Water provider', '4020'),
    (6, 'other', 'Other', 3000, 3000, 'other', NULL, '4010')
)
INSERT INTO "Expense" (
  "id", "societyId", "title", "amount", "category", "paidTo", "paidOn",
  "notes", "tdsAmount", "tdsPercent", "netPayable", "approvalStatus",
  "submittedBy", "submittedByUserId", "submittedAt", "approvedBy", "approvedAt",
  "createdAt"
)
SELECT
  'expense_gps_2026_06_' || slug,
  society_id,
  title,
  revised_amount,
  category,
  paid_to,
  expense_month,
  'Monthly expense baseline import. Old amount: ' || old_amount || ', revised amount: ' || revised_amount || '.',
  0,
  0,
  revised_amount,
  'approved',
  actor_name,
  actor_user_id,
  CURRENT_TIMESTAMP,
  actor_name,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM expense_source
CROSS JOIN import_context
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "amount" = EXCLUDED."amount",
  "category" = EXCLUDED."category",
  "paidTo" = EXCLUDED."paidTo",
  "paidOn" = EXCLUDED."paidOn",
  "notes" = EXCLUDED."notes",
  "netPayable" = EXCLUDED."netPayable",
  "approvalStatus" = 'approved',
  "approvedBy" = EXCLUDED."approvedBy",
  "approvedAt" = EXCLUDED."approvedAt";

WITH import_context AS (
  SELECT
    'soc_godavari_puram'::text AS society_id,
    'Godavari Puram Import'::text AS actor_name,
    DATE '2026-06-01' AS expense_month
),
expense_source(line_no, slug, title, old_amount, revised_amount, category, paid_to, account_code) AS (
  VALUES
    (1, 'sweeper', 'Sweeper', 8000, 10000, 'housekeeping_salary', 'Sweeper', '4000'),
    (2, 'housekeeping_material', 'Housekeeping material', 1500, 1500, 'housekeeping', 'Housekeeping material vendor', '4030'),
    (3, 'security_charges', 'Security Charges', 18000, 32000, 'security_salary', 'Security agency', '4000'),
    (4, 'electricity_bill', 'Electricity Bill', 45000, 45000, 'electricity_common_area', 'Electricity provider', '4020'),
    (5, 'water_bill', 'Water Bill', 5000, 5000, 'water_bill', 'Water provider', '4020'),
    (6, 'other', 'Other', 3000, 3000, 'other', NULL, '4010')
)
INSERT INTO "JournalVoucher" (
  "id", "societyId", "voucherNumber", "voucherDate", "narration", "status",
  "createdBy", "postedAt", "createdAt", "updatedAt"
)
SELECT
  'jv_gps_2026_06_' || slug,
  society_id,
  'JV-GPS-2026-06-EXP-' || lpad(line_no::text, 3, '0'),
  expense_month,
  'Expense ' || title,
  'POSTED',
  actor_name,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM expense_source
CROSS JOIN import_context
ON CONFLICT ("id") DO UPDATE SET
  "voucherDate" = EXCLUDED."voucherDate",
  "narration" = EXCLUDED."narration",
  "status" = 'POSTED',
  "createdBy" = EXCLUDED."createdBy",
  "postedAt" = EXCLUDED."postedAt",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH import_context AS (
  SELECT
    'soc_godavari_puram'::text AS society_id,
    DATE '2026-06-01' AS expense_month
),
expense_source(line_no, slug, title, old_amount, revised_amount, category, paid_to, account_code) AS (
  VALUES
    (1, 'sweeper', 'Sweeper', 8000, 10000, 'housekeeping_salary', 'Sweeper', '4000'),
    (2, 'housekeeping_material', 'Housekeeping material', 1500, 1500, 'housekeeping', 'Housekeeping material vendor', '4030'),
    (3, 'security_charges', 'Security Charges', 18000, 32000, 'security_salary', 'Security agency', '4000'),
    (4, 'electricity_bill', 'Electricity Bill', 45000, 45000, 'electricity_common_area', 'Electricity provider', '4020'),
    (5, 'water_bill', 'Water Bill', 5000, 5000, 'water_bill', 'Water provider', '4020'),
    (6, 'other', 'Other', 3000, 3000, 'other', NULL, '4010')
),
journal_lines AS (
  SELECT slug, account_code, revised_amount AS debit, 0::float AS credit, 'Expense recognized' AS memo, 'debit' AS side
  FROM expense_source
  UNION ALL
  SELECT slug, '1010', 0::float, revised_amount, 'Payment made', 'credit'
  FROM expense_source
)
INSERT INTO "JournalVoucherLine" ("id", "voucherId", "accountId", "debit", "credit", "memo")
SELECT
  'jvl_gps_2026_06_' || slug || '_' || side,
  'jv_gps_2026_06_' || slug,
  la."id",
  debit,
  credit,
  memo
FROM journal_lines
CROSS JOIN import_context
JOIN "LedgerAccount" la
  ON la."societyId" = society_id
 AND la."code" = journal_lines.account_code
ON CONFLICT ("id") DO UPDATE SET
  "voucherId" = EXCLUDED."voucherId",
  "accountId" = EXCLUDED."accountId",
  "debit" = EXCLUDED."debit",
  "credit" = EXCLUDED."credit",
  "memo" = EXCLUDED."memo";

WITH import_context AS (
  SELECT
    'soc_godavari_puram'::text AS society_id,
    'Godavari Puram Import'::text AS actor_name,
    DATE '2026-06-01' AS expense_month
),
expense_source(line_no, slug, title, old_amount, revised_amount, category, paid_to, account_code) AS (
  VALUES
    (1, 'sweeper', 'Sweeper', 8000, 10000, 'housekeeping_salary', 'Sweeper', '4000'),
    (2, 'housekeeping_material', 'Housekeeping material', 1500, 1500, 'housekeeping', 'Housekeeping material vendor', '4030'),
    (3, 'security_charges', 'Security Charges', 18000, 32000, 'security_salary', 'Security agency', '4000'),
    (4, 'electricity_bill', 'Electricity Bill', 45000, 45000, 'electricity_common_area', 'Electricity provider', '4020'),
    (5, 'water_bill', 'Water Bill', 5000, 5000, 'water_bill', 'Water provider', '4020'),
    (6, 'other', 'Other', 3000, 3000, 'other', NULL, '4010')
)
INSERT INTO "FinancialTransaction" (
  "id", "societyId", "sourceType", "sourceId", "description",
  "transactionDate", "createdBy", "createdAt"
)
SELECT
  'ft_gps_2026_06_' || slug,
  society_id,
  'EXPENSE',
  'expense_gps_2026_06_' || slug,
  'Expense ' || title,
  expense_month,
  actor_name,
  CURRENT_TIMESTAMP
FROM expense_source
CROSS JOIN import_context
ON CONFLICT ("id") DO UPDATE SET
  "sourceType" = EXCLUDED."sourceType",
  "sourceId" = EXCLUDED."sourceId",
  "description" = EXCLUDED."description",
  "transactionDate" = EXCLUDED."transactionDate",
  "createdBy" = EXCLUDED."createdBy";

WITH import_context AS (
  SELECT
    'soc_godavari_puram'::text AS society_id,
    DATE '2026-06-01' AS expense_month
),
expense_source(line_no, slug, title, old_amount, revised_amount, category, paid_to, account_code) AS (
  VALUES
    (1, 'sweeper', 'Sweeper', 8000, 10000, 'housekeeping_salary', 'Sweeper', '4000'),
    (2, 'housekeeping_material', 'Housekeeping material', 1500, 1500, 'housekeeping', 'Housekeeping material vendor', '4030'),
    (3, 'security_charges', 'Security Charges', 18000, 32000, 'security_salary', 'Security agency', '4000'),
    (4, 'electricity_bill', 'Electricity Bill', 45000, 45000, 'electricity_common_area', 'Electricity provider', '4020'),
    (5, 'water_bill', 'Water Bill', 5000, 5000, 'water_bill', 'Water provider', '4020'),
    (6, 'other', 'Other', 3000, 3000, 'other', NULL, '4010')
),
ledger_lines AS (
  SELECT slug, account_code, revised_amount AS debit, 0::float AS credit, 'Expense recognized' AS memo, 'debit' AS side
  FROM expense_source
  UNION ALL
  SELECT slug, '1010', 0::float, revised_amount, 'Payment made', 'credit'
  FROM expense_source
)
INSERT INTO "LedgerEntry" (
  "id", "societyId", "transactionId", "accountId", "debit", "credit", "memo", "postedAt"
)
SELECT
  'le_gps_2026_06_' || slug || '_' || side,
  society_id,
  'ft_gps_2026_06_' || slug,
  la."id",
  debit,
  credit,
  memo,
  expense_month
FROM ledger_lines
CROSS JOIN import_context
JOIN "LedgerAccount" la
  ON la."societyId" = society_id
 AND la."code" = ledger_lines.account_code
ON CONFLICT ("id") DO UPDATE SET
  "transactionId" = EXCLUDED."transactionId",
  "accountId" = EXCLUDED."accountId",
  "debit" = EXCLUDED."debit",
  "credit" = EXCLUDED."credit",
  "memo" = EXCLUDED."memo",
  "postedAt" = EXCLUDED."postedAt";

WITH expense_source(line_no, slug, title, old_amount, revised_amount, category, paid_to, account_code) AS (
  VALUES
    (1, 'sweeper', 'Sweeper', 8000, 10000, 'housekeeping_salary', 'Sweeper', '4000'),
    (2, 'housekeeping_material', 'Housekeeping material', 1500, 1500, 'housekeeping', 'Housekeeping material vendor', '4030'),
    (3, 'security_charges', 'Security Charges', 18000, 32000, 'security_salary', 'Security agency', '4000'),
    (4, 'electricity_bill', 'Electricity Bill', 45000, 45000, 'electricity_common_area', 'Electricity provider', '4020'),
    (5, 'water_bill', 'Water Bill', 5000, 5000, 'water_bill', 'Water provider', '4020'),
    (6, 'other', 'Other', 3000, 3000, 'other', NULL, '4010')
)
UPDATE "Expense" e
SET "journalVoucherId" = 'jv_gps_2026_06_' || expense_source.slug
FROM expense_source
WHERE e."id" = 'expense_gps_2026_06_' || expense_source.slug;

INSERT INTO "ActivityLog" (
  "id", "societyId", "userId", "userName", "action", "module",
  "targetId", "targetLabel", "details", "createdAt"
)
VALUES (
  'activity_gps_expenses_2026_06',
  'soc_godavari_puram',
  'user_gps_chairman',
  'Godavari Puram Import',
  'created',
  'expense',
  'soc_godavari_puram',
  'June 2026 monthly expenses',
  'Imported revised monthly expenses: Sweeper 10000, Housekeeping material 1500, Security Charges 32000, Electricity Bill 45000, Water Bill 5000, Other 3000. Total 96500.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
```

## Post-Import Checks

```sql
SELECT "title", "category", "amount", "paidOn", "approvalStatus", "journalVoucherId"
FROM "Expense"
WHERE "societyId" = 'soc_godavari_puram'
  AND "id" LIKE 'expense_gps_2026_06_%'
ORDER BY "paidOn", "title";

SELECT SUM("amount") AS revised_monthly_expense_total
FROM "Expense"
WHERE "societyId" = 'soc_godavari_puram'
  AND "id" LIKE 'expense_gps_2026_06_%';

SELECT
  SUM("debit") AS ledger_debit,
  SUM("credit") AS ledger_credit
FROM "LedgerEntry"
WHERE "societyId" = 'soc_godavari_puram'
  AND "id" LIKE 'le_gps_2026_06_%';
```
