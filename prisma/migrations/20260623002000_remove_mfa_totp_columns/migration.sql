ALTER TABLE "User"
  DROP COLUMN IF EXISTS "mfaTotpSecretEncrypted",
  DROP COLUMN IF EXISTS "mfaEnrolledAt";
