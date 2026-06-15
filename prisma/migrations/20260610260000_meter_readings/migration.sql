-- Meter reading import (Feature 9)

ALTER TABLE "Society" ADD COLUMN "meterRatesJson" TEXT;

CREATE TABLE "MeterReadingImportSession" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "meterType" TEXT NOT NULL,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "appliedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "totalCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importedBy" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReadingImportSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "flatId" TEXT,
    "importSessionId" TEXT,
    "period" TEXT NOT NULL,
    "meterType" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "previousReading" DOUBLE PRECISION NOT NULL,
    "currentReading" DOUBLE PRECISION NOT NULL,
    "unitsConsumed" DOUBLE PRECISION NOT NULL,
    "ratePerUnit" DOUBLE PRECISION,
    "chargeAmount" DOUBLE PRECISION NOT NULL,
    "billId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeterReading_societyId_flatId_period_meterType_key" ON "MeterReading"("societyId", "flatId", "period", "meterType");
CREATE INDEX "MeterReading_societyId_period_idx" ON "MeterReading"("societyId", "period");
CREATE INDEX "MeterReadingImportSession_societyId_period_meterType_idx" ON "MeterReadingImportSession"("societyId", "period", "meterType");

ALTER TABLE "MeterReadingImportSession" ADD CONSTRAINT "MeterReadingImportSession_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "MeterReadingImportSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_billId_fkey" FOREIGN KEY ("billId") REFERENCES "MaintenanceBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
