import { NextRequest, NextResponse } from "next/server";
import { decryptSession } from "@/lib/session";
import { getBearerTokenFromRequest, getSessionFromRequest } from "@/lib/auth-request";
import { canAccess, getDefaultRoute, isWatchmanRole } from "@/lib/role-access";
import { apiRateLimit } from "@/lib/rate-limit";

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
  return response;
}

// Paths accessible without login
const publicPaths = [
  "/login",
  "/register",
  "/join",
  "/auth/complete",
  "/api/auth/login",      // JSON + HTML form login
  "/api/auth/register",
  "/api/auth/join",
  "/api/auth/callback",   // Keycloak OIDC callback
  "/api/societies/join-code",
  "/gate",                // Guard PWA (standalone)
  "/api/guard",           // Guard API endpoints
  "/api/guard/join",      // Guard self-request with society join code
  "/expired",             // Subscription expired page
  "/complaint/submit",    // Public complaint submission
  "/api/complaints/public",
  "/pay",                 // Public one-click bill payment (no login)
  "/api/pay",             // Public payment link API
  "/api/noc/verify",      // Public NOC certificate verification
  "/api/subscription",    // Subscription check
  "/api/health/db",       // DB connectivity diagnostic (redacted host only)
];

// Static assets that should never go through auth
const assetPatterns = [
  "/_next",
  "/favicon",
  "/icons",
  "/manifest.json",
  "/sw.js",
  "/robots.txt",
  "/sitemap.xml",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/SmartSocietyHub" || pathname === "/SmartSocietyHub/") {
    const session = request.cookies.get("session")?.value;
    const payload = session ? await decryptSession(session) : null;
    const destination = payload ? getDefaultRoute(payload.role) : "/login";
    const response = NextResponse.redirect(new URL(destination, request.url), 307);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return withSecurityHeaders(response);
  }

  // Allow static assets
  if (assetPatterns.some((p) => pathname.startsWith(p)) || pathname.includes(".")) {
    return withSecurityHeaders(NextResponse.next());
  }

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return withSecurityHeaders(NextResponse.next());
  }

  // Check session (Bearer header for tab-scoped sessions, cookie for legacy flows)
  const cookieToken = request.cookies.get("session")?.value;
  const payload = await getSessionFromRequest(request, cookieToken);
  const isApiRoute = pathname.startsWith("/api/");

  if (!payload) {
    if (isApiRoute) {
      return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    // Dashboard pages authenticate client-side via tab sessionStorage
    return withSecurityHeaders(NextResponse.next());
  }

  // If logged in and visiting auth pages, redirect to role-appropriate page
  if (pathname === "/login" || pathname === "/register") {
    const defaultRoute = getDefaultRoute(payload.role);
    return withSecurityHeaders(NextResponse.redirect(new URL(defaultRoute, request.url)));
  }

  // ── Role-Based Access Control ─────────────────────────
  const userRole = payload.role || "member";

  if (pathname === "/") {
    const defaultRoute = getDefaultRoute(userRole);
    return withSecurityHeaders(NextResponse.redirect(new URL(defaultRoute, request.url)));
  }

  // Enforce RBAC on API routes only — HTML pages use client TabSessionGate
  if (
    isApiRoute &&
    !canAccess(userRole, pathname, {
      societyId: payload.societyId,
      subject: payload.userId,
      mfaVerified: payload.mfaVerified,
    })
  ) {
    return withSecurityHeaders(NextResponse.json(
      { error: "Access denied. Your role does not have permission for this resource." },
      { status: 403 }
    ));
  }

  if (isApiRoute) {
    try {
      if (!(await apiRateLimit(payload.userId))) {
        return withSecurityHeaders(NextResponse.json(
          { error: "Too many requests. Please try again shortly." },
          { status: 429 }
        ));
      }
    } catch {
      // Fail-open: allow request if rate limiter backend is unavailable (e.g. Valkey not running locally)
    }
  }

  // Watchman trying to access /dashboard → redirect to /visitors (cookie-based legacy only)
  if (isWatchmanRole(userRole) && pathname === "/dashboard" && cookieToken && !getBearerTokenFromRequest(request)) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/visitors", request.url)));
  }

  // Heartbeat for session tracking — ONLY on page navigations (not API calls), with 60s throttle
  const session = cookieToken;
  if (session && !isApiRoute) {
    const lastBeat = request.cookies.get("_hb")?.value;
    const now = Date.now();
    if (!lastBeat || now - parseInt(lastBeat) > 60_000) {
      const heartbeatUrl = new URL("/api/sessions/heartbeat", request.url);
      fetch(heartbeatUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: session }),
      }).catch(() => {});

      const response = NextResponse.next();
      response.cookies.set("_hb", String(now), {
        httpOnly: true,
        maxAge: 120,
        path: "/",
        sameSite: "lax",
      });
      return withSecurityHeaders(response);
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
