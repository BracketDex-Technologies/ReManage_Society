import { createPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const adminCount = await prisma.portalAdmin.count();
    if (adminCount > 0) {
      return Response.json({ error: "Portal owner already exists. Please log in." }, { status: 403 });
    }

    const { name, email, password } = await request.json();
    if (!name || !email || !password) {
      return Response.json({ error: "Name, email, and password are required" }, { status: 400 });
    }
    if (String(password).length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(String(password), 12);
    const admin = await prisma.portalAdmin.create({
      data: {
        name: String(name).trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: "owner",
      },
    });

    await createPortalSession(admin);

    return Response.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Portal register error:", error);
    return Response.json({ error: "Unable to create portal owner" }, { status: 500 });
  }
}
