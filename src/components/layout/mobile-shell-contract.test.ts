import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const notificationCenter = readFileSync(resolve(process.cwd(), "src/components/ui/NotificationCenter.tsx"), "utf8");
const sidebar = readFileSync(resolve(process.cwd(), "src/components/layout/Sidebar.tsx"), "utf8");
const dashboardLayout = readFileSync(resolve(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
const dashboard = readFileSync(resolve(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("mobile shell contracts", () => {
  it("uses a compact unread dot inside the mobile bell", () => {
    expect(notificationCenter).toContain('compact ? "absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white dark:ring-[#222222] animate-pulse"');
  });

  it("keeps a visible logout label in the compact mobile sidebar", () => {
    expect(sidebar).toContain('isCompact && <span className="text-[9px] font-black leading-none lg:hidden">{t("Sign Out")}</span>');
  });

  it("places the mobile logout action in the sidebar footer", () => {
    expect(sidebar.indexOf('className={`mt-auto')).toBeLessThan(sidebar.indexOf('data-testid="mobile-sidebar-logout"'));
  });

  it("keeps the sidebar footer visible by restricting scroll to navigation", () => {
    expect(sidebar).toContain('flex-1 min-h-0 overflow-y-auto');
    expect(sidebar).toContain('mt-auto shrink-0');
  });

  it("hides the universal bottom navigation while the sidebar drawer is open", () => {
    expect(dashboardLayout).toContain('{!sidebarOpen && (');
    expect(dashboardLayout).toContain('<BottomNav userRole={user.role} userId={user.id} societyId={user.societyId} />');
  });

  it("limits resident landing-page bottom space to bottom-navigation clearance", () => {
    expect(dashboard).toContain('dashboard-flat-theme block w-full space-y-4 pb-16');
  });

  it("keeps semantic dashboard surfaces and action buttons inside the mobile viewport", () => {
    expect(styles).toContain('.dashboard-flat-theme .dashboard-panel,\n  .dashboard-flat-theme .dashboard-subpanel');
    expect(styles).toContain('.dashboard-flat-theme .dashboard-panel :is(h1, h2, h3, p),');
  });
});
