import { deleteSession, getOidcLogoutUrl, getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return handleLogout(request);
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}

async function handleLogout(request: NextRequest) {
  const session = await getSession();
  await deleteSession();
  
  const postLogoutRedirectUri = new URL("/login", request.url).toString();
  // We can pass id_token_hint here if we stored it, but we only store accessToken right now
  const logoutUrl = getOidcLogoutUrl(undefined, postLogoutRedirectUri);
  
  redirect(logoutUrl);
}
