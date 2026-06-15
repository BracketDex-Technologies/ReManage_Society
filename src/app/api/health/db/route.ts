import { getDatabaseTarget } from "@society/db";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const database = getDatabaseTarget();
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  try {
    const userCount = await prisma.user.count();
    const emailExists = email
      ? Boolean(
          await prisma.user.findUnique({
            where: { email },
            select: { id: true },
          }),
        )
      : undefined;

    return Response.json({
      ok: true,
      database,
      userCount,
      ...(email ? { emailRegistered: emailExists } : {}),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        database,
        error: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 500 },
    );
  }
}
