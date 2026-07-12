import { createPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const admin = await prisma.portalAdmin.findUnique({ where: { email: cleanEmail } });
    if (!admin || !admin.isActive) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const validPassword = await bcrypt.compare(String(password), admin.password);
    if (!validPassword) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await createPortalSession(admin);

    return Response.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Portal login error:", error);
    return Response.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
