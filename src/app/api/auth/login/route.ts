import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { authRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDefaultRoute } from "@/lib/role-access";

// Retry helper for transient PgBouncer / connection errors
async function findUserWithRetry(email: string, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await prisma.user.findUnique({ where: { email } });
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function parseLoginBody(request: NextRequest): Promise<{
  email: string;
  password: string;
  wantsRedirect: boolean;
}> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      wantsRedirect: false,
    };
  }

  const form = await request.formData();
  return {
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    wantsRedirect: form.get("redirect") === "1",
  };
}

function loginErrorResponse(
  request: NextRequest,
  wantsRedirect: boolean,
  code: string,
  status: number,
) {
  if (wantsRedirect) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(code)}`, request.url),
      303,
    );
  }

  const messages: Record<string, string> = {
    missing_fields: "Email and password are required",
    invalid_credentials: "Invalid credentials",
    membership_pending: "Your society membership is pending approval.",
    rate_limited: "Too many login attempts. Please wait 1 minute.",
    server_error: "Login failed. Please try again.",
  };

  return Response.json({ error: messages[code] || code }, { status });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  let wantsRedirect = !contentType.includes("application/json");

  try {
    // Rate limit by IP
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0] || "unknown";
    if (!(await authRateLimit(ip))) {
      return loginErrorResponse(request, wantsRedirect, "rate_limited", 429);
    }

    const credentials = await parseLoginBody(request);
    wantsRedirect = credentials.wantsRedirect;
    const { email, password } = credentials;

    if (!email || !password) {
      return loginErrorResponse(request, wantsRedirect, "missing_fields", 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await findUserWithRetry(cleanEmail);

    if (!user || !user.isActive) {
      return loginErrorResponse(request, wantsRedirect, "invalid_credentials", 401);
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return loginErrorResponse(request, wantsRedirect, "invalid_credentials", 401);
    }

    let sessionToken: string;
    try {
      sessionToken = await createSession(user, { persistCookie: false });
    } catch (error) {
      if (error instanceof Error && error.message === "No active society membership for this account") {
        return loginErrorResponse(request, wantsRedirect, "membership_pending", 403);
      }
      throw error;
    }

    // Check society subscription
    if (user.societyId) {
      try {
        const society = await prisma.society.findUnique({
          where: { id: user.societyId },
          select: { subscriptionEnd: true },
        });
        if (society?.subscriptionEnd && new Date(society.subscriptionEnd) < new Date()) {
          if (wantsRedirect) {
            return NextResponse.redirect(new URL("/expired", request.url), 303);
          }
          return Response.json({
            user: { id: user.id, name: user.name, email: user.email, role: user.role, societyId: user.societyId },
            sessionToken,
            expired: true,
          });
        }
      } catch (subErr) {
        // Don't block login if subscription check fails
        console.error("Subscription check failed (non-fatal):", subErr);
      }
    }

    if (wantsRedirect) {
      const landingRoute = getDefaultRoute(user.role);
      const redirectUrl = new URL("/auth/complete", request.url);
      redirectUrl.searchParams.set("next", landingRoute);
      redirectUrl.searchParams.set("token", sessionToken);
      return NextResponse.redirect(redirectUrl, 303);
    }

    return Response.json({
      sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        societyId: user.societyId,
      },
    });
  } catch (error: unknown) {
    console.error("Login Error:", error instanceof Error ? error.message : error);
    return loginErrorResponse(request, wantsRedirect, "server_error", 500);
  }
}

