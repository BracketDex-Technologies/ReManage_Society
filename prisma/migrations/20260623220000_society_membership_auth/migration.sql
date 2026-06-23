ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SocietyMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "productRole" TEXT NOT NULL,
  "permissionRole" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "flatId" TEXT,
  "personId" TEXT,
  "approvedByUserId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SocietyMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocietyMembership_userId_societyId_key"
  ON "SocietyMembership"("userId", "societyId");

CREATE INDEX "SocietyMembership_userId_status_idx"
  ON "SocietyMembership"("userId", "status");

CREATE INDEX "SocietyMembership_societyId_status_idx"
  ON "SocietyMembership"("societyId", "status");

CREATE INDEX "SocietyMembership_societyId_permissionRole_status_idx"
  ON "SocietyMembership"("societyId", "permissionRole", "status");

ALTER TABLE "SocietyMembership"
  ADD CONSTRAINT "SocietyMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocietyMembership"
  ADD CONSTRAINT "SocietyMembership_societyId_fkey"
  FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocietyMembership"
  ADD CONSTRAINT "SocietyMembership_flatId_fkey"
  FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocietyMembership"
  ADD CONSTRAINT "SocietyMembership_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SocietyMembership" (
  "id",
  "userId",
  "societyId",
  "productRole",
  "permissionRole",
  "status",
  "flatId",
  "personId",
  "activatedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy_membership_' || u."id",
  u."id",
  u."societyId",
  CASE u."role"
    WHEN 'chairman' THEN 'chairman'
    WHEN 'secretary' THEN 'secretary'
    WHEN 'treasurer' THEN 'treasurer'
    WHEN 'guard' THEN 'guard'
    WHEN 'watchman' THEN 'guard'
    WHEN 'tenant' THEN 'tenant'
    WHEN 'facility_manager' THEN 'secretary'
    ELSE 'member'
  END,
  CASE u."role"
    WHEN 'chairman' THEN 'society_admin'
    WHEN 'secretary' THEN 'committee'
    WHEN 'treasurer' THEN 'treasurer'
    WHEN 'guard' THEN 'guard'
    WHEN 'watchman' THEN 'guard'
    WHEN 'tenant' THEN 'tenant'
    WHEN 'facility_manager' THEN 'committee'
    ELSE 'member'
  END,
  'active',
  u."flatId",
  u."personId",
  CURRENT_TIMESTAMP,
  u."createdAt",
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."societyId" IS NOT NULL
ON CONFLICT ("userId", "societyId") DO NOTHING;
