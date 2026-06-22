"use client";

const SESSION_KEY = "rms.session";
const LEGACY_SESSION_KEY = "rms.tabSession";
const MFA_CHALLENGE_KEY = "rms.mfaChallenge";

export function getTabSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const persistedToken = localStorage.getItem(SESSION_KEY);
    if (persistedToken) return persistedToken;

    // Preserve a session created by an earlier app version while it is still open.
    const legacyToken = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (legacyToken) {
      localStorage.setItem(SESSION_KEY, legacyToken);
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    }
    return legacyToken;
  } catch {
    return null;
  }
}

export function setTabSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    // localStorage belongs to the WebView profile, so it survives Android app restarts.
    localStorage.setItem(SESSION_KEY, token);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function clearTabSessionToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function getMfaChallengeToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(MFA_CHALLENGE_KEY);
  } catch {
    return null;
  }
}

export function setMfaChallengeToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(MFA_CHALLENGE_KEY, token);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function clearMfaChallengeToken(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(MFA_CHALLENGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function getAuthHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = getTabSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function logoutCurrentTab(): Promise<void> {
  const token = getTabSessionToken();
  clearTabSessionToken();
  if (token) {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}
