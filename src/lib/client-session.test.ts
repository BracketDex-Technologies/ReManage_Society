import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearTabSessionToken,
  getTabSessionToken,
  setTabSessionToken,
} from "./client-session";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("persistent client sessions", () => {
  it("keeps the authentication token in persistent device storage", () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    vi.stubGlobal("window", { localStorage, sessionStorage });
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);

    setTabSessionToken("persisted-token");

    expect(localStorage.getItem("rms.session")).toBe("persisted-token");
    expect(getTabSessionToken()).toBe("persisted-token");
  });

  it("migrates a currently-open legacy session to persistent storage", () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    sessionStorage.setItem("rms.tabSession", "legacy-token");
    vi.stubGlobal("window", { localStorage, sessionStorage });
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);

    expect(getTabSessionToken()).toBe("legacy-token");
    expect(localStorage.getItem("rms.session")).toBe("legacy-token");
    expect(sessionStorage.getItem("rms.tabSession")).toBeNull();
  });

  it("removes both persistent and legacy tokens on sign out", () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    localStorage.setItem("rms.session", "token");
    sessionStorage.setItem("rms.tabSession", "legacy-token");
    vi.stubGlobal("window", { localStorage, sessionStorage });
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);

    clearTabSessionToken();

    expect(localStorage.getItem("rms.session")).toBeNull();
    expect(sessionStorage.getItem("rms.tabSession")).toBeNull();
  });
});
