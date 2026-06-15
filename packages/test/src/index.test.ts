import { describe, expect, it } from "vitest";
import { createTestClock, createTestId } from "./index.js";

describe("@society/test shared helpers", () => {
  it("creates deterministic IDs with readable prefixes", () => {
    expect(createTestId("society")).toBe("society_test_0001");
    expect(createTestId("society")).toBe("society_test_0002");
    expect(createTestId("unit")).toBe("unit_test_0001");
  });

  it("creates a fixed test clock", () => {
    const clock = createTestClock("2026-06-05T10:30:00.000Z");

    expect(clock.now()).toEqual(new Date("2026-06-05T10:30:00.000Z"));
    expect(clock.iso()).toBe("2026-06-05T10:30:00.000Z");
  });
});
