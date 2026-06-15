import { describe, expect, it } from "vitest";
import {
  decodeDocumentCategory,
  documentVersionKey,
  encodeDocumentCategory,
  normalizeDocumentCategory,
  normalizeDocumentScope,
  resolveDocumentVisibility,
} from "./index.ts";

describe("document normalization", () => {
  it("normalizes scope and category with defaults", () => {
    expect(normalizeDocumentScope(undefined)).toBe("society");
    expect(normalizeDocumentScope(" Flat ")).toBe("flat");
    expect(normalizeDocumentCategory(undefined)).toBe("general");
    expect(normalizeDocumentCategory("BYLAWS")).toBe("bylaws");
  });

  it("rejects unsupported scope/category", () => {
    expect(() => normalizeDocumentScope("galaxy")).toThrow();
    expect(() => normalizeDocumentCategory("memes")).toThrow();
  });
});

describe("encode/decode document category", () => {
  it("round-trips a flat-scoped document", () => {
    const encoded = encodeDocumentCategory({ category: "noc", scope: "flat", ownerRef: "A-101" });
    expect(encoded).toBe("noc#flat:A-101");
    expect(decodeDocumentCategory(encoded)).toEqual({
      category: "noc",
      scope: "flat",
      ownerRef: "A-101",
    });
  });

  it("defaults society ownerRef", () => {
    const encoded = encodeDocumentCategory({ category: "bylaws", scope: "society" });
    expect(encoded).toBe("bylaws#society:society");
  });

  it("requires an ownerRef for flat/personal scopes", () => {
    expect(() => encodeDocumentCategory({ category: "noc", scope: "personal" })).toThrow(/ownerRef/);
  });

  it("treats a legacy plain category as society scope", () => {
    expect(decodeDocumentCategory("financial")).toEqual({
      category: "financial",
      scope: "society",
      ownerRef: "society",
    });
  });
});

describe("resolveDocumentVisibility", () => {
  const manager = { userId: "c1", isManager: true };
  const resident = { userId: "u1", flatNumber: "A-101", isManager: false };

  it("shows society documents to everyone", () => {
    expect(
      resolveDocumentVisibility({ scope: "society", ownerRef: "society", viewer: resident }),
    ).toBe(true);
  });

  it("shows flat documents only to that flat or a manager", () => {
    expect(
      resolveDocumentVisibility({ scope: "flat", ownerRef: "A-101", viewer: resident }),
    ).toBe(true);
    expect(
      resolveDocumentVisibility({ scope: "flat", ownerRef: "B-202", viewer: resident }),
    ).toBe(false);
    expect(
      resolveDocumentVisibility({ scope: "flat", ownerRef: "B-202", viewer: manager }),
    ).toBe(true);
  });

  it("shows personal documents only to the owner or a manager", () => {
    expect(
      resolveDocumentVisibility({ scope: "personal", ownerRef: "u1", viewer: resident }),
    ).toBe(true);
    expect(
      resolveDocumentVisibility({ scope: "personal", ownerRef: "u2", viewer: resident }),
    ).toBe(false);
    expect(
      resolveDocumentVisibility({ scope: "personal", ownerRef: "u2", viewer: manager }),
    ).toBe(true);
  });
});

describe("documentVersionKey", () => {
  it("is deterministic per society/scope/owner/title", () => {
    expect(
      documentVersionKey({ societyId: "s1", scope: "flat", ownerRef: "A-101", title: "NOC Letter" }),
    ).toBe("s1:flat:A-101:noc letter");
  });
});
