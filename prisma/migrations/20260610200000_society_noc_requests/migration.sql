-- Automated society NOC requests
CREATE TABLE "SocietyNocRequest" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "certificateNo" TEXT NOT NULL,
    "totalDuesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockedReason" TEXT,
    "pdfDataUrl" TEXT,
    "verificationHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocietyNocRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocietyNocRequest_certificateNo_key" ON "SocietyNocRequest"("certificateNo");
CREATE INDEX "SocietyNocRequest_societyId_createdAt_idx" ON "SocietyNocRequest"("societyId", "createdAt");
CREATE INDEX "SocietyNocRequest_flatId_purpose_validUntil_idx" ON "SocietyNocRequest"("flatId", "purpose", "validUntil");
CREATE INDEX "SocietyNocRequest_requestedBy_createdAt_idx" ON "SocietyNocRequest"("requestedBy", "createdAt");

ALTER TABLE "SocietyNocRequest" ADD CONSTRAINT "SocietyNocRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocietyNocRequest" ADD CONSTRAINT "SocietyNocRequest_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
