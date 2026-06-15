import { describe, expect, it } from "vitest";
import { selectPersonaNavState } from "./use-persona-nav.ts";

describe("selectPersonaNavState", () => {
  it("returns guard bottom nav without finance links", () => {
    const state = selectPersonaNavState({
      subject: "guard_1",
      societyId: "society_a",
      role: "guard",
    });

    expect(state.persona).toBe("guard");
    expect(state.bottomNav.map((item) => item.href)).toEqual(
      expect.arrayContaining(["/visitors", "/packages", "/emergency"]),
    );
    expect(state.navigation.sections.some((section) => section.title === "FINANCE")).toBe(false);
  });

  it("returns resident billing in bottom nav", () => {
    const state = selectPersonaNavState({
      subject: "resident_1",
      societyId: "society_a",
      role: "member",
    });

    expect(state.persona).toBe("resident");
    expect(state.bottomNav.some((item) => item.href === "/my-bills")).toBe(true);
    expect(state.quickActions.some((action) => action.id === "pay-bill")).toBe(true);
  });
});
