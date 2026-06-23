import { deleteSession } from "@/lib/auth";
import { getBearerTokenFromRequest } from "@/lib/auth-request";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  await handleLogout(request);
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}

async function handleLogout(request: NextRequest) {
  const bearer = getBearerTokenFromRequest(request);
  await deleteSession(bearer);
  return Response.json({ ok: true });
}
