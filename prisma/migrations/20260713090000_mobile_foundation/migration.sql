-- CreateTable
CREATE TABLE "SocietyRoleAssignment" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionRole" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocietyRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileDeviceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "deviceName" TEXT,
    "activeRole" TEXT NOT NULL,
    "activePermissionRole" TEXT NOT NULL,
    "refreshFamilyId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "refreshRotation" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileDeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileOtpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocietyRoleAssignment_membershipId_role_key" ON "SocietyRoleAssignment"("membershipId", "role");

-- CreateIndex
CREATE INDEX "SocietyRoleAssignment_membershipId_permissionRole_revokedAt_idx" ON "SocietyRoleAssignment"("membershipId", "permissionRole", "revokedAt");

-- CreateIndex
CREATE INDEX "MobileDeviceSession_userId_societyId_installationId_revokedAt_idx" ON "MobileDeviceSession"("userId", "societyId", "installationId", "revokedAt");

-- CreateIndex
CREATE INDEX "MobileDeviceSession_societyId_revokedAt_expiresAt_idx" ON "MobileDeviceSession"("societyId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobileDeviceSession_one_active_installation_idx"
ON "MobileDeviceSession" ("userId", "societyId", "installationId")
WHERE "revokedAt" IS NULL;

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_identifierHash_createdAt_idx" ON "MobileOtpChallenge"("identifierHash", "createdAt");

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_installationId_createdAt_idx" ON "MobileOtpChallenge"("installationId", "createdAt");

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_expiresAt_consumedAt_idx" ON "MobileOtpChallenge"("expiresAt", "consumedAt");

-- AddForeignKey
ALTER TABLE "SocietyRoleAssignment" ADD CONSTRAINT "SocietyRoleAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "SocietyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileDeviceSession" ADD CONSTRAINT "MobileDeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileDeviceSession" ADD CONSTRAINT "MobileDeviceSession_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "SocietyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileDeviceSession" ADD CONSTRAINT "MobileDeviceSession_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileOtpChallenge" ADD CONSTRAINT "MobileOtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileOtpChallenge" ADD CONSTRAINT "MobileOtpChallenge_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SocietyRoleAssignment" (
  "id",
  "membershipId",
  "role",
  "permissionRole",
  "createdAt"
)
SELECT
  CONCAT('mra_', MD5("id" || ':' || "productRole")),
  "id",
  CASE
    WHEN "productRole" IN ('member', 'tenant', 'resident') THEN 'resident'
    WHEN "productRole" IN ('guard', 'watchman') THEN 'guard'
  END,
  "permissionRole",
  CURRENT_TIMESTAMP
FROM "SocietyMembership"
WHERE "status" = 'active'
  AND "productRole" IN ('member', 'tenant', 'resident', 'guard', 'watchman')
ON CONFLICT DO NOTHING;
