-- AMC & insurance compliance alerts (Feature 8)

ALTER TABLE "Vendor" ADD COLUMN "insuranceExpiryDate" TIMESTAMP(3);

ALTER TABLE "Complaint" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "Complaint" ADD COLUMN "sourceId" TEXT;

CREATE INDEX "Complaint_societyId_sourceType_sourceId_idx" ON "Complaint"("societyId", "sourceType", "sourceId");
