import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

// POST: Auto-generate login credentials for all flats that don't have user accounts
const LEGACY_ROUTE = "/api/credentials";
const NEST_POST = "/api/v1/society-core/credentials/issue";

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary"].includes(session!.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { flatId, action } = body;

    if (action === "create_committee") {
      if (session.role !== "chairman") {
        return Response.json({ error: "Only chairman can create committee admin accounts" }, { status: 403 });
      }

      const role = String(body.role || "").toLowerCase();
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const password = String(body.password || "");

      if (!["secretary", "treasurer"].includes(role)) {
        return Response.json({ error: "Role must be secretary or treasurer" }, { status: 400 });
      }
      if (!name || !email || !password) {
        return Response.json({ error: "Name, email, and password are required" }, { status: 400 });
      }
      if (password.length < 6) {
        return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return Response.json({ error: "Email already registered" }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: phone || null,
          role,
          societyId: session.societyId,
        },
        select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
      });

      return Response.json({ user, message: `${role} account created` }, { status: 201 });
    }

    // Get flats that need accounts
    const where: Record<string, unknown> = { societyId: session!.societyId };
    if (flatId) where.id = flatId;

    const flats = await prisma.flat.findMany({
      where,
      include: { users: { select: { id: true, email: true } } },
    });

    const createdAccounts: Array<{
      flatNumber: string;
      wing: string | null;
      ownerName: string | null;
      email: string;
      password: string;
      role: string;
    }> = [];

    for (const flat of flats) {
      // Skip if flat already has a user account
      if (flat.users.length > 0) continue;

      // Generate credentials: email = flatnumber@societyid.society, password = flat + phone last 4
      const sanitizedFlat = flat.flatNumber.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const email = `${sanitizedFlat}@${session!.societyId.slice(0, 8)}.resident`;
      if (!flat.ownerName || !flat.contact) continue;

      const rawPassword = `${sanitizedFlat}${flat.contact.slice(-4)}`;
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      try {
        await prisma.user.create({
          data: {
            name: flat.ownerName,
            email,
            password: hashedPassword,
            phone: flat.contact,
            role: "member",
            societyId: session!.societyId,
            flatId: flat.id,
          },
        });

        createdAccounts.push({
          flatNumber: flat.flatNumber,
          wing: flat.wing,
          ownerName: flat.ownerName,
          email,
          password: rawPassword,
          role: "member",
        });
      } catch {
        // Skip duplicates
      }
    }

    return Response.json({
      created: createdAccounts.length,
      accounts: createdAccounts,
      message: `Created ${createdAccounts.length} resident accounts. Share credentials securely.`,
    });
  } catch {
    return Response.json({ error: "Failed to generate credentials" }, { status: 500 });
  }
}

// GET: List all member credentials (admin only)
async function legacyGET() {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary"].includes(session!.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [users, society] = await Promise.all([
      prisma.user.findMany({
        where: { societyId: session!.societyId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          flatId: true,
          flat: { select: { flatNumber: true, wing: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.society.findUnique({
        where: { id: session!.societyId },
        select: { joinCode: true },
      }),
    ]);

    // Group by role
    const grouped = {
      admins: users.filter((u) => ["chairman", "secretary", "treasurer"].includes(u.role)),
      members: users.filter((u) => u.role === "member"),
      tenants: users.filter((u) => u.role === "tenant"),
      guards: users.filter((u) => u.role === "guard"),
      total: users.length,
      joinCode: society?.joinCode || null,
    };

    return Response.json(grouped);
  } catch {
    return Response.json({ error: "Failed to fetch credentials" }, { status: 500 });
  }
}

export const POST = shimOrFallback({ legacyRoute: "/api/credentials", nestPath: "/api/v1/society-core/credentials/issue", method: "POST" }, legacyPOST);
export const GET = shimOrFallback({ legacyRoute: "/api/credentials", nestPath: "/api/v1/society-core/credentials/issue", method: "GET" }, legacyGET);
