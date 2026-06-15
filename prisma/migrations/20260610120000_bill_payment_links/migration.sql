-- CreateTable
CREATE TABLE "BillPaymentLink" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "sentVia" TEXT,
    "sentToPhone" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillPaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillPaymentLink_token_key" ON "BillPaymentLink"("token");

-- CreateIndex
CREATE INDEX "BillPaymentLink_billId_idx" ON "BillPaymentLink"("billId");

-- CreateIndex
CREATE INDEX "BillPaymentLink_societyId_billId_idx" ON "BillPaymentLink"("societyId", "billId");

-- AddForeignKey
ALTER TABLE "BillPaymentLink" ADD CONSTRAINT "BillPaymentLink_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPaymentLink" ADD CONSTRAINT "BillPaymentLink_billId_fkey" FOREIGN KEY ("billId") REFERENCES "MaintenanceBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
