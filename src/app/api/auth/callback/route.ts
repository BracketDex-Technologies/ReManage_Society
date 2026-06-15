import { NextRequest } from "next/server";
import { exchangeOidcCode, createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return redirect("/login?error=" + encodeURIComponent(error));
  }

  if (!code) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    // Reconstruct the redirectUri that was passed to Keycloak
    const redirectUri = new URL("/api/auth/callback", request.url).toString();
    const tokenResponse = await exchangeOidcCode(code, redirectUri);
    
    // Parse the id_token to get user info
    const idTokenPayload = JSON.parse(Buffer.from(tokenResponse.id_token.split('.')[1], 'base64').toString());
    
    const email = idTokenPayload.email;
    const name = idTokenPayload.name || idTokenPayload.preferred_username || "Unknown User";
    
    // Upsert user based on email (as fallback auth mechanism might already have created it)
    const user = await prisma.user.upsert({
      where: { email },
      update: { 
        name 
      },
      create: {
        email,
        name,
        password: "OIDC_LOGIN_NO_PASSWORD", // OIDC users don't have local passwords
        role: "tenant", // Use a safe default, real role can be assigned by admin
      }
    });

    await createSession({
      id: user.id,
      societyId: user.societyId,
      role: user.role,
      name: user.name,
      email: user.email,
      flatId: user.flatId,
      accessToken: tokenResponse.access_token,
    });

    return redirect("/dashboard");
  } catch (err: unknown) {
    console.error("OIDC callback failed:", err);
    return redirect("/login?error=OIDC_EXCHANGE_FAILED");
  }
}
