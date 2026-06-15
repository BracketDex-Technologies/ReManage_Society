import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { generateJoinCode } from "@/lib/join-code";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, phone, societyName, societyAddress, city, pincode } =
      await request.json();

    if (!name || !email || !password || !societyName || !societyAddress || !city || !pincode) {
      return Response.json(
        { error: "All required fields must be filled" },
        { status: 400 }
      );
    }

    // Sanitize email
    const cleanEmail = email.trim().toLowerCase();

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return Response.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // Chairman-only SaaS onboarding: one society is created here, residents join later by code.
    const { user, society } = await prisma.$transaction(async (tx) => {
      let joinCode = generateJoinCode(societyName);
      for (let attempt = 0; attempt < 5; attempt++) {
        const existingCode = await tx.society.findUnique({ where: { joinCode } });
        if (!existingCode) break;
        joinCode = generateJoinCode(societyName);
      }

      const society = await tx.society.create({
        data: {
          name: societyName.trim(),
          joinCode,
          address: societyAddress.trim(),
          city: city.trim(),
          pincode: pincode.trim(),
          // 30-day free trial
          subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          planTier: "trial",
        },
      });

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          password: hashedPassword,
          phone: phone || null,
          role: "chairman",
          societyId: society.id,
        },
      });

      return { user, society };
    });

    // Auto-login after registration (fixes the intermittent login issue)
    await createSession(user);

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        societyId: user.societyId,
      },
      society: {
        id: society.id,
        name: society.name,
        joinCode: society.joinCode,
      },
    });
  } catch (error: unknown) {
    console.error("Register Error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(", ")
          : String(error.meta?.target || "");
        if (target.includes("email")) {
          return Response.json({ error: "Email already registered" }, { status: 400 });
        }
        if (target.includes("joinCode")) {
          return Response.json({ error: "Could not generate a unique join code. Please try again." }, { status: 400 });
        }
      }

      if (error.code === "P2022") {
        return Response.json(
          { error: "Database is not synced. Please run Prisma db push and try again." },
          { status: 500 }
        );
      }
    }

    return Response.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
