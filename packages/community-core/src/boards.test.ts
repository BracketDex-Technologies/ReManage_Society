import { describe, expect, it } from "vitest";
import {
  applyForumModeration,
  applyListingTransition,
  applyModeration,
  assertThreadNotLocked,
  isListingPubliclyVisible,
  normalizeForumCategory,
  normalizeListingCategory,
  normalizeListingCondition,
  normalizeListingPrivacy,
  resolveListingContactVisibility,
} from "./index.ts";

describe("forum", () => {
  it("normalizes categories and rejects unknown ones", () => {
    expect(normalizeForumCategory(undefined)).toBe("general");
    expect(normalizeForumCategory("Buy-Sell")).toBe("buy-sell");
    expect(() => normalizeForumCategory("spam")).toThrow();
  });

  it("blocks replies to locked threads", () => {
    expect(() => assertThreadNotLocked(true)).toThrow(/locked/);
    expect(() => assertThreadNotLocked(false)).not.toThrow();
  });

  it("maps moderation actions to flags", () => {
    expect(applyForumModeration("pin")).toEqual({ isPinned: true });
    expect(applyForumModeration("unlock")).toEqual({ isLocked: false });
    expect(() => applyForumModeration("delete")).toThrow();
  });
});

describe("marketplace normalization", () => {
  it("normalizes category, condition, and privacy", () => {
    expect(normalizeListingCategory(undefined)).toBe("general");
    expect(normalizeListingCondition(undefined)).toBe("good");
    expect(normalizeListingCondition("LIKE_NEW")).toBe("like_new");
    expect(normalizeListingPrivacy(undefined)).toBe("society");
    expect(() => normalizeListingCategory("weapons")).toThrow();
  });
});

describe("applyListingTransition", () => {
  it("walks the listing lifecycle", () => {
    expect(applyListingTransition({ current: "active", action: "reserve" })).toEqual({
      status: "reserved",
    });
    expect(applyListingTransition({ current: "reserved", action: "sell" })).toEqual({
      status: "sold",
    });
    expect(() => applyListingTransition({ current: "sold", action: "reserve" })).toThrow();
  });
});

describe("applyModeration", () => {
  it("maps moderation actions to statuses", () => {
    expect(applyModeration("approve")).toEqual({ moderationStatus: "approved", listingStatus: null });
    expect(applyModeration("report")).toEqual({ moderationStatus: "reported", listingStatus: null });
    expect(applyModeration("archive")).toEqual({ moderationStatus: null, listingStatus: "expired" });
    expect(() => applyModeration("ban")).toThrow();
  });
});

describe("listing visibility", () => {
  it("hides non-active or rejected listings from the public", () => {
    expect(isListingPubliclyVisible({ status: "active", moderationStatus: "approved" })).toBe(true);
    expect(isListingPubliclyVisible({ status: "sold", moderationStatus: "approved" })).toBe(false);
    expect(isListingPubliclyVisible({ status: "active", moderationStatus: "rejected" })).toBe(false);
  });

  it("resolves contact visibility by privacy and viewer", () => {
    expect(
      resolveListingContactVisibility({
        privacyStatus: "society",
        viewer: { isVerifiedResident: false, isManager: false },
      }),
    ).toBe(true);
    expect(
      resolveListingContactVisibility({
        privacyStatus: "verified_residents",
        viewer: { isVerifiedResident: false, isManager: false },
      }),
    ).toBe(false);
    expect(
      resolveListingContactVisibility({
        privacyStatus: "hidden_contact",
        viewer: { isVerifiedResident: true, isManager: false },
      }),
    ).toBe(false);
    expect(
      resolveListingContactVisibility({
        privacyStatus: "hidden_contact",
        viewer: { isVerifiedResident: false, isManager: true },
      }),
    ).toBe(true);
  });
});
