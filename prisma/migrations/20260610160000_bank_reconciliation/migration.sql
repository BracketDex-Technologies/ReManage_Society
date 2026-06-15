-- AlterTable
ALTER TABLE "FinancialTransaction" ADD COLUMN "reconciledAt" TIMESTAMP(3),
ADD COLUMN "reconciledBy" TEXT;

-- CreateIndex
CREATE INDEX "FinancialTransaction_societyId_transactionDate_idx" ON "FinancialTransaction"("societyId", "transactionDate");

-- CreateIndex
CREATE INDEX "FinancialTransaction_societyId_reconciledAt_idx" ON "FinancialTransaction"("societyId", "reconciledAt");

-- CreateTable
CREATE TABLE "BankReconciliationSession" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "fileName" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalLines" INTEGER NOT NULL DEFAULT 0,
    "matchedLines" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankReconciliationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "amount" FLOAT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchScore" DOUBLE PRECISION,
    "matchedSourceType" TEXT,
    "matchedSourceId" TEXT,
    "financialTransactionId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankReconciliationSession_societyId_createdAt_idx" ON "BankReconciliationSession"("societyId", "createdAt");

-- CreateIndex
CREATE INDEX "BankStatementLine_societyId_matchStatus_idx" ON "BankStatementLine"("societyId", "matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_sessionId_rowIndex_key" ON "BankStatementLine"("sessionId", "rowIndex");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_financialTransactionId_key" ON "BankStatementLine"("financialTransactionId");

-- AddForeignKey
ALTER TABLE "BankReconciliationSession" ADD CONSTRAINT "BankReconciliationSession_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BankReconciliationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
