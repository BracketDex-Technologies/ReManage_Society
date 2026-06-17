import { describe, expect, it } from "vitest";
import {
  canRaiseComplaint,
  canUseResidentSelfService,
  committeeSelfServiceError,
  isCommitteeRole,
  isResidentRole,
} from "./roles";

describe("isCommitteeRole", () => {
  it("matches committee roles", () => {
    expect(isCommitteeRole("chairman")).toBe(true);
    expect(isCommitteeRole("member")).toBe(false);
  });
});

describe("isResidentRole", () => {
  it("matches resident roles only", () => {
    expect(isResidentRole("tenant")).toBe(true);
    expect(isResidentRole("chairman")).toBe(false);
  });
});

describe("canUseResidentSelfService", () => {
  it("allows residents but not committee", () => {
    expect(canUseResidentSelfService("member")).toBe(true);
    expect(canUseResidentSelfService("secretary")).toBe(false);
  });
});

describe("canRaiseComplaint", () => {
  it("allows residents and gate staff", () => {
    expect(canRaiseComplaint("member")).toBe(true);
    expect(canRaiseComplaint("guard")).toBe(true);
    expect(canRaiseComplaint("chairman")).toBe(false);
  });
});

describe("committeeSelfServiceError", () => {
  it("blocks committee self-service actions", () => {
    expect(committeeSelfServiceError("chairman")).toContain("Committee accounts");
    expect(committeeSelfServiceError("member")).toBeNull();
  });
});
