import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import mr from "../../messages/mr.json";

function expectTranslated(common: Record<string, string>, key: string) {
  const translated = common[key];
  expect(translated).toBeDefined();
  expect(translated).not.toBe(key);
  expect(translated).toMatch(/[\u0900-\u097F]/);
}

describe("locale messages", () => {
  it("translates auth copy in auth namespace", () => {
    expect(hi.auth.signInTitle).toMatch(/[\u0900-\u097F]/);
    expect(mr.auth.signInTitle).toMatch(/[\u0900-\u097F]/);
  });

  it("translates operations module page strings without hybrid English", () => {
    const keys = [
      "Track complaints, ownership, urgency, and resolution progress.",
      "Register & track domestic staff attendance",
      "Track deliveries & courier packages",
      "Pre-approve & track visitors",
      "Parcel Desk",
    ];
    for (const key of keys) {
      expectTranslated(hi.common, key);
      expect(hi.common[key]).not.toMatch(/ownership|urgency|Register &/);
    }
  });

  it("translates dashboard neighbourhood cards", () => {
    expectTranslated(hi.common, "Quick Access Services");
    expectTranslated(hi.common, "Recent Notices");
    expectTranslated(hi.common, "Gate Deliveries");
    expectTranslated(mr.common, "Find your neighbors");
  });

  it("keeps english keys as values in en locale", () => {
    expect(en.common["Help Desk"]).toBe("Help Desk");
    expect(en.auth.signInTitle).toBe("Sign in to your account");
  });

  it("has matching common key counts across locales", () => {
    expect(Object.keys(hi.common).length).toBe(Object.keys(en.common).length);
    expect(Object.keys(mr.common).length).toBe(Object.keys(en.common).length);
  });
});
