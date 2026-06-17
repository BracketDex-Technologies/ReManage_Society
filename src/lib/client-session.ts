"use client";

const SESSION_KEY = "rms.tabSession";

export function getTabSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setTabSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, token);
}

export function clearTabSessionToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
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
