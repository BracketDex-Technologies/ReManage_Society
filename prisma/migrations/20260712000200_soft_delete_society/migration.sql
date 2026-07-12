ALTER TABLE "Society"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedByPortalAdminId" TEXT,
  ADD COLUMN "deletionReason" TEXT;
