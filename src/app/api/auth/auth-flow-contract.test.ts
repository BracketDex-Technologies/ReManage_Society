import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRoute(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("approved authentication flow contracts", () => {
  it("creates an active Chairman membership inside society registration", () => {
    const route = readRoute("src/app/api/auth/register/route.ts");

    expect(route).toContain("tx.societyMembership.create");
    expect(route).toContain('productRole: "chairman"');
    expect(route).toContain('permissionRole: "society_admin"');
    expect(route).toContain('status: "active"');
  });

  it("creates a pending membership and occupancy claim for resident join", () => {
    const route = readRoute("src/app/api/auth/join/route.ts");

    expect(route).toContain("tx.societyMembership.create");
    expect(route).toContain('status: "pending"');
    expect(route).toContain('occupancyStatus: "PENDING"');
  });

  it("does not send pending residents to the authenticated dashboard", () => {
    const page = readRoute("src/app/(auth)/join/page.tsx");

    expect(page).toContain('"Join request submitted for approval"');
    expect(page).toContain('router.push("/login")');
  });

  it("builds sessions from an active society membership", () => {
    const auth = readRoute("src/lib/auth.ts");

    expect(auth).toContain("prisma.societyMembership.findFirst");
    expect(auth).toContain('status: "active"');
    expect(auth).toContain("permissionRole: membership.permissionRole");
  });

  it("contains no alternate OIDC or Keycloak sign-in path", () => {
    const auth = readRoute("src/lib/auth.ts");
    const loginRoute = readRoute("src/app/api/auth/login/route.ts");
    const loginForm = readRoute("src/app/(auth)/login/LoginForm.tsx");

    expect(auth).not.toContain("Oidc");
    expect(loginRoute).not.toContain("Keycloak");
    expect(loginForm).not.toContain("Keycloak");
  });

  it("rejects inactive users and reports pending membership approval at login", () => {
    const login = readRoute("src/app/api/auth/login/route.ts");

    expect(login).toContain("!user.isActive");
    expect(login).toContain('"membership_pending"');
  });

  it("scopes resident approval to the committee member's society", () => {
    const approval = readRoute("src/app/api/memberships/[id]/approve/route.ts");

    expect(approval).toContain('["chairman", "secretary"].includes(session.role)');
    expect(approval).toContain('societyId: session.societyId');
    expect(approval).toContain('status: "pending"');
    expect(approval).toContain('status: "active"');
    expect(approval).toContain('occupancyStatus: "ACTIVE"');
  });

  it("scopes resident rejection to the committee member's society", () => {
    const rejection = readRoute("src/app/api/memberships/[id]/reject/route.ts");

    expect(rejection).toContain('["chairman", "secretary"].includes(session.role)');
    expect(rejection).toContain('societyId: session.societyId');
    expect(rejection).toContain('status: "pending"');
    expect(rejection).toContain('status: "rejected"');
    expect(rejection).toContain('occupancyStatus: "REJECTED"');
    expect(rejection).toContain('isActive: false');
  });

  it("provisions all approved staff roles into the Chairman's society", () => {
    const credentials = readRoute("src/app/api/credentials/route.ts");

    expect(credentials).toContain('["secretary", "treasurer", "guard"].includes(role)');
    expect(credentials).toContain("tx.societyMembership.create");
    expect(credentials).toContain("societyId: session.societyId");
  });

  it("offers Guard alongside Secretary and Treasurer in the staff form", () => {
    const credentialsPage = readRoute("src/app/(dashboard)/credentials/page.tsx");

    expect(credentialsPage).toContain('<option value="guard">Guard</option>');
  });
});
