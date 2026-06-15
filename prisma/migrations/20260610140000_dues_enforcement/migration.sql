-- AlterTable
ALTER TABLE "Society" ADD COLUMN "duesEnforcementEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Society" ADD COLUMN "duesEnforcementDays" INTEGER NOT NULL DEFAULT 60;
