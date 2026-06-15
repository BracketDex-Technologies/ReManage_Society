import { describe, expect, it } from "vitest";
import {
  buildNavigationModel,
  buildQuickActions,
  filterNavItems,
  getDefaultRoute,
  NAV_CATALOG,
  normalizeSearchResult,
  resolvePersona,
} from "./index.ts";
import type { UxPermissionAction } from "./index.ts";

function actionSet(...actions: UxPermissionAction[]): ReadonlySet<UxPermissionAction> {
  return new Set(actions);
}

const RESIDENT_ACTIONS = actionSet(
  "society:finance.read",
  "operations:visitor.respond",
  "operations:read",
  "operations:booking.manage",
  "operations:sos.raise",
  "community:read",
  "community:helpdesk.respond",
  "community:vote.cast",
  "community:rsvp.manage",
  "community:post",
);

const GUARD_ACTIONS = actionSet(
  "operations:gate.manage",
  "operations:read",
  "operations:sos.raise",
  "community:read",
);

const COMMITTEE_ACTIONS = actionSet(
  "audit:event.read",
  "society:core.manage",
  "society:directory.read",
  "society:finance.read",
  "society:finance.manage",
  "society:occupancy.manage",
  "society:import.manage",
  "society:settings.manage",
  "operations:gate.manage",
  "operations:visitor.respond",
  "operations:read",
  "operations:manage",
  "operations:booking.manage",
  "operations:sos.raise",
  "community:read",
  "community:notice.manage",
  "community:helpdesk.respond",
  "community:helpdesk.manage",
  "community:document.manage",
  "community:governance.manage",
  "community:vote.cast",
  "community:rsvp.manage",
  "community:post",
  "community:moderate",
);

describe("resolvePersona", () => {
  it("maps legacy roles to UX personas", () => {
    expect(resolvePersona("chairman")).toBe("committee");
    expect(resolvePersona("secretary")).toBe("committee");
    expect(resolvePersona("treasurer")).toBe("treasurer");
    expect(resolvePersona("member")).toBe("resident");
    expect(resolvePersona("tenant")).toBe("resident");
    expect(resolvePersona("guard")).toBe("guard");
    expect(resolvePersona("watchman")).toBe("guard");
    expect(resolvePersona("facility_manager")).toBe("operations_desk");
    expect(resolvePersona("vendor_staff")).toBe("vendor");
  });

  it("prefers platform_admin when platform role is present", () => {
    expect(resolvePersona("member", ["platform_admin"])).toBe("platform_admin");
  });

  it("rejects unknown legacy roles", () => {
    expect(() => resolvePersona("unknown")).toThrow(/Unknown legacy role/);
  });
});

describe("getDefaultRoute", () => {
  it("routes guards to the gate console first", () => {
    expect(getDefaultRoute("guard")).toBe("/visitors");
  });

  it("routes platform admins to the system console", () => {
    expect(getDefaultRoute("platform_admin")).toBe("/system");
  });
});

describe("filterNavItems", () => {
  it("returns resident finance and community items only", () => {
    const items = filterNavItems(NAV_CATALOG, "resident", RESIDENT_ACTIONS);
    const hrefs = items.map((item) => item.href);

    expect(hrefs).toContain("/my-bills");
    expect(hrefs).toContain("/my-visitors");
    expect(hrefs).not.toContain("/maintenance");
    expect(hrefs).not.toContain("/visitors");
  });

  it("pins my bills ahead of other resident finance links", () => {
    const items = filterNavItems(NAV_CATALOG, "resident", RESIDENT_ACTIONS);
    const myBills = items.find((item) => item.href === "/my-bills");

    expect(myBills?.pinned).toBe(true);
  });

  it("returns only gate operations for guards", () => {
    const items = filterNavItems(NAV_CATALOG, "guard", GUARD_ACTIONS);
    const hrefs = items.map((item) => item.href);

    expect(hrefs).toEqual(expect.arrayContaining(["/visitors", "/packages", "/notices", "/emergency"]));
    expect(hrefs).not.toContain("/maintenance");
    expect(hrefs).not.toContain("/forum");
  });
});

describe("buildNavigationModel", () => {
  it("groups committee navigation into finance and management sections", () => {
    const model = buildNavigationModel("committee", COMMITTEE_ACTIONS);
    const sectionTitles = model.sections.map((section) => section.title);

    expect(model.defaultRoute).toBe("/dashboard");
    expect(sectionTitles).toContain("FINANCE");
    expect(sectionTitles).toContain("MANAGEMENT");
    expect(model.sections.find((section) => section.title === "FINANCE")?.items.some((item) => item.href === "/maintenance")).toBe(true);
  });

  it("omits finance sections for guards", () => {
    const model = buildNavigationModel("guard", GUARD_ACTIONS);

    expect(model.defaultRoute).toBe("/visitors");
    expect(model.sections.some((section) => section.title === "FINANCE")).toBe(false);
  });
});

describe("buildQuickActions", () => {
  it("returns resident quick actions for billing and visitors", () => {
    const actions = buildQuickActions("resident", RESIDENT_ACTIONS);

    expect(actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["approve-visitor", "pay-bill", "raise-complaint", "raise-sos"]),
    );
  });

  it("returns guard gate actions only", () => {
    const actions = buildQuickActions("guard", GUARD_ACTIONS);

    expect(actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["log-visitor", "parcel-desk", "raise-sos"]),
    );
    expect(actions.some((action) => action.id === "pay-bill")).toBe(false);
  });
});

describe("normalizeSearchResult", () => {
  it("hides sensitive directory rows from residents", () => {
    expect(
      normalizeSearchResult(
        {
          type: "directory",
          title: "A-101",
          subtitle: "9999999999",
          href: "/directory",
          sensitive: true,
        },
        "resident",
      ),
    ).toBeNull();
  });

  it("keeps non-sensitive results for residents", () => {
    expect(
      normalizeSearchResult(
        {
          type: "notice",
          title: "Water shutdown",
          href: "/notices/1",
        },
        "resident",
      ),
    ).toEqual({
      type: "notice",
      title: "Water shutdown",
      subtitle: undefined,
      href: "/notices/1",
    });
  });

  it("hides finance search hits from guards", () => {
    expect(
      normalizeSearchResult(
        {
          type: "finance",
          title: "Invoice #12",
          href: "/maintenance",
        },
        "guard",
      ),
    ).toBeNull();
  });
});
