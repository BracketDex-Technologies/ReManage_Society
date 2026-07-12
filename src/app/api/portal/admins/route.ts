import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

export async function GET() {
  const { response } = await requirePortalSession();
  if (response) return response;

  const admins = await prisma.portalAdmin.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ admins });
}

export async function POST(request: NextRequest) {
  const { response } = await requirePortalSession();
  if (response) return response;

  try {
    const { name, email, password } = await request.json();
    if (!name || !email || !password) {
      return Response.json({ error: "Name, email, and password are required" }, { status: 400 });
    }
    if (String(password).length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await prisma.portalAdmin.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return Response.json({ error: "Portal admin email already exists" }, { status: 400 });
    }

    const admin = await prisma.portalAdmin.create({
      data: {
        name: String(name).trim(),
        email: cleanEmail,
        password: await bcrypt.hash(String(password), 12),
        role: "partner",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return Response.json({ admin }, { status: 201 });
  } catch (error) {
    console.error("Portal partner create error:", error);
    return Response.json({ error: "Unable to create partner credentials" }, { status: 500 });
  }
}
