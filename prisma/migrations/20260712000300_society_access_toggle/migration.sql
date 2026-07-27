ALTER TABLE "Society"
  ADD COLUMN "accessDisabledAt" TIMESTAMP(3),
  ADD COLUMN "accessDisabledByPortalAdminId" TEXT,
  ADD COLUMN "accessDisableReason" TEXT;
