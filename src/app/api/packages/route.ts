import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/packages";
const NEST_GET = "/api/v1/operations/packages/list";
const NEST_POST = "/api/v1/operations/packages/log";

async function legacyGET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { societyId: session!.societyId };
    if (status) where.status = status;

    const packages = await prisma.package.findMany({
      where,
      include: {
        flat: { select: { flatNumber: true, wing: true, ownerName: true, contact: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return Response.json(packages);
  } catch {
    return Response.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { flatNumber, courierName, description } = await request.json();

    if (!flatNumber) {
      return Response.json({ error: "Flat number is required" }, { status: 400 });
    }

    const flat = await prisma.flat.findFirst({
      where: { societyId: session!.societyId, flatNumber },
    });

    if (!flat) {
      return Response.json({ error: "Flat not found" }, { status: 404 });
    }

    const pickupOtp = String(Math.floor(1000 + Math.random() * 9000));

    const pkg = await prisma.package.create({
      data: {
        societyId: session!.societyId,
        flatId: flat.id,
        courierName: courierName || "Unknown",
        description: description || null,
        loggedBy: session.name || "Guard",
        pickupOtp,
        status: "received",
      },
      include: {
        flat: { select: { flatNumber: true, wing: true, ownerName: true } },
      },
    });

    await prisma.notification.create({
      data: {
        societyId: session!.societyId,
        type: "package_arrived",
        title: "📦 Package Arrived",
        message: `A package from ${courierName || "unknown courier"} has been received at the gate for flat ${flatNumber}.`,
        link: "/packages",
      },
    });

    return Response.json(pkg);
  } catch {
    return Response.json({ error: "Failed to log package" }, { status: 500 });
  }
}

async function legacyPATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { packageId, action, collectedBy } = await request.json();

    if (!packageId || !action) {
      return Response.json({ error: "Package ID and action required" }, { status: 400 });
    }

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, societyId: session!.societyId },
    });

    if (!pkg) {
      return Response.json({ error: "Package not found" }, { status: 404 });
    }

    let data: Record<string, unknown> = {};

    if (action === "collected") {
      data = { status: "collected", collectedAt: new Date(), collectedBy: collectedBy || "Resident" };
    } else if (action === "returned") {
      data = { status: "returned" };
    }

    const updated = await prisma.package.update({
      where: { id: packageId },
      data,
      include: {
        flat: { select: { flatNumber: true, wing: true, ownerName: true } },
      },
    });

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Failed to update package" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/packages", nestPath: "/api/v1/operations/packages", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/packages", nestPath: "/api/v1/operations/packages", method: "POST" }, legacyPOST);
export const PATCH = shimOrFallback({ legacyRoute: "/api/packages", nestPath: "/api/v1/operations/packages", method: "PATCH" }, legacyPATCH);
