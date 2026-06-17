import { deleteSession, getOidcLogoutUrl } from "@/lib/auth";
import { getBearerTokenFromRequest } from "@/lib/auth-request";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return handleLogout(request);
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}

async function handleLogout(request: NextRequest) {
  const bearer = getBearerTokenFromRequest(request);
  await deleteSession(bearer);
  
  const postLogoutRedirectUri = new URL("/login", request.url).toString();
  const logoutUrl = getOidcLogoutUrl(undefined, postLogoutRedirectUri);
  
  redirect(logoutUrl);
}
