ALTER TABLE "User"
  ADD COLUMN "mfaTotpSecretEncrypted" TEXT,
  ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3);
