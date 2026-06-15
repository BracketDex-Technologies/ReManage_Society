-- Digital move-in/out wizard fields
ALTER TABLE "Society" ADD COLUMN "moveInShiftingCharge" DOUBLE PRECISION NOT NULL DEFAULT 2000;
ALTER TABLE "Society" ADD COLUMN "moveOutShiftingCharge" DOUBLE PRECISION NOT NULL DEFAULT 1500;

ALTER TABLE "MoveEvent" ADD COLUMN "workflowStatus" TEXT NOT NULL DEFAULT 'checklist';
ALTER TABLE "MoveEvent" ADD COLUMN "policeVerificationFileName" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "policeVerificationFileType" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "policeVerificationDataUrl" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "leaseAgreementFileName" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "leaseAgreementFileType" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "leaseAgreementDataUrl" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "shiftingChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MoveEvent" ADD COLUMN "shiftingChargePaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MoveEvent" ADD COLUMN "shiftingChargePaidAt" TIMESTAMP(3);
ALTER TABLE "MoveEvent" ADD COLUMN "shiftingPaymentRef" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "gatePassCode" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "gatePassIssuedAt" TIMESTAMP(3);
ALTER TABLE "MoveEvent" ADD COLUMN "gatePassPdfDataUrl" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "MoveEvent" ADD COLUMN "rejectedReason" TEXT;
ALTER TABLE "MoveEvent" ADD COLUMN "scheduledMoveDate" TIMESTAMP(3);
ALTER TABLE "MoveEvent" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "MoveEvent_gatePassCode_key" ON "MoveEvent"("gatePassCode");
CREATE INDEX "MoveEvent_societyId_workflowStatus_idx" ON "MoveEvent"("societyId", "workflowStatus");
