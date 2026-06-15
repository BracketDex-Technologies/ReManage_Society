-- Phase 2 tenant isolation manifest.
-- Apply after setting app.current_society_id per request/session.

-- Generated from packages/db/src/tenant-rls-manifest.ts.
ALTER TABLE "MaintenanceBill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaintenanceBill" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MaintenanceBill";
CREATE POLICY tenant_isolation ON "MaintenanceBill" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Invoice";
CREATE POLICY tenant_isolation ON "Invoice" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Payment";
CREATE POLICY tenant_isolation ON "Payment" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Expense";
CREATE POLICY tenant_isolation ON "Expense" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "Complaint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Complaint" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Complaint";
CREATE POLICY tenant_isolation ON "Complaint" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "Notice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notice" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Notice";
CREATE POLICY tenant_isolation ON "Notice" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Document";
CREATE POLICY tenant_isolation ON "Document" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ActivityLog";
CREATE POLICY tenant_isolation ON "ActivityLog" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Notification";
CREATE POLICY tenant_isolation ON "Notification" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "Visitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Visitor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Visitor";
CREATE POLICY tenant_isolation ON "Visitor" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "Package" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Package" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Package";
CREATE POLICY tenant_isolation ON "Package" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "UserSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "UserSession";
CREATE POLICY tenant_isolation ON "UserSession" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));

ALTER TABLE "SecurityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SecurityEvent";
CREATE POLICY tenant_isolation ON "SecurityEvent" USING ("societyId" = current_setting('app.current_society_id', true)) WITH CHECK ("societyId" = current_setting('app.current_society_id', true));
