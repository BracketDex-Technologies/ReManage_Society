-- Maker-checker expense approval workflow
ALTER TABLE "Expense" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "Expense" ADD COLUMN "submittedBy" TEXT;
ALTER TABLE "Expense" ADD COLUMN "submittedByUserId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "Expense" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "rejectedBy" TEXT;
ALTER TABLE "Expense" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Expense" ADD COLUMN "journalVoucherId" TEXT;

CREATE UNIQUE INDEX "Expense_journalVoucherId_key" ON "Expense"("journalVoucherId");
CREATE INDEX "Expense_societyId_approvalStatus_idx" ON "Expense"("societyId", "approvalStatus");
