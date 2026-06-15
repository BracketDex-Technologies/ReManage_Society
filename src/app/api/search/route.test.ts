import { describe, expect, it } from "vitest";
import { normalizeSearchResult, resolvePersona } from "@society/ux-core";

describe("search permission shaping", () => {
  it("hides finance results from guards", () => {
    expect(
      normalizeSearchResult(
        { type: "finance", title: "Invoice", href: "/maintenance" },
        resolvePersona("guard"),
      ),
    ).toBeNull();
  });

  it("keeps notices for residents", () => {
    expect(
      normalizeSearchResult(
        { type: "notice", title: "Water shutdown", href: "/notices" },
        resolvePersona("member"),
      ),
    ).toEqual({
      type: "notice",
      title: "Water shutdown",
      subtitle: undefined,
      href: "/notices",
    });
  });
});
