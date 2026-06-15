import { getSession } from "@/lib/auth";
import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logCreated } from "@/lib/activity-log";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/visitors";
const NEST_LIST = "/api/v1/operations/visitors/list";

type LegacyVisitorRow = Record<string, unknown> & {
  entryTime?: unknown;
  arrivedAt?: unknown;
  status?: string;
};

function adaptNestVisitors(records: LegacyVisitorRow[]): LegacyVisitorRow[] {
  return records.map((record) => ({
    ...record,
    entryTime: record.entryTime ?? record.arrivedAt ?? null,
  }));
}

async function legacyGET(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const date = searchParams.get("date") || "";

  if (isNestShimEnabled()) {
    const proxied = await proxyNestJson<Array<Record<string, unknown>>>({
      path: NEST_LIST,
      session,
      body: {
        societyId: session.societyId,
        status: status || undefined,
      },
    });

    if (proxied.ok) {
      let visitors = adaptNestVisitors(proxied.data);
      if (date) {
        const d = new Date(date);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        visitors = visitors.filter((visitor) => {
          const entry = visitor.entryTime ? new Date(String(visitor.entryTime)) : null;
          return entry && entry >= dayStart && entry < dayEnd;
        });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const stats = {
        todayTotal: visitors.filter((visitor) => {
          const entry = visitor.entryTime ? new Date(String(visitor.entryTime)) : null;
          return entry && entry >= todayStart;
        }).length,
        currentlyIn: visitors.filter((visitor) => visitor.status === "in" || visitor.status === "inside")
          .length,
      };

      return jsonWithHeaders(
        { visitors: visitors.slice(0, 100), stats },
        {
          status: 200,
          extraHeaders: {
            ...buildDeprecationHeaders({
              routePath: LEGACY_ROUTE,
              successorPath: NEST_LIST,
            }),
            ...passThroughRateLimitHeaders(proxied.headers),
          },
        },
      );
    }
  }

  const where: Record<string, unknown> = { societyId: session.societyId };
  if (status) where.status = status;
  if (date) {
    const d = new Date(date);
    where.entryTime = {
      gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
      lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
    };
  }

  const visitors = await prisma.visitor.findMany({
    where,
    orderBy: { entryTime: "desc" },
    take: 100,
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const stats = {
    todayTotal: await prisma.visitor.count({
      where: { societyId: session.societyId, entryTime: { gte: todayStart } },
    }),
    currentlyIn: await prisma.visitor.count({
      where: { societyId: session.societyId, status: "in" },
    }),
  };

  return jsonWithHeaders(
    { visitors, stats },
    {
      status: 200,
      extraHeaders: buildDeprecationHeaders({
        routePath: LEGACY_ROUTE,
        successorPath: NEST_LIST,
      }),
    },
  );
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { flatNumber, visitorName, phone, purpose, vehicleNo, notes } = body;

    if (!flatNumber || !visitorName || !purpose) {
      return Response.json({ error: "Flat number, visitor name, and purpose are required" }, { status: 400 });
    }

    // Try to find flat
    const flat = await prisma.flat.findFirst({
      where: { societyId: session!.societyId, flatNumber },
    });

    const visitor = await prisma.visitor.create({
      data: {
        societyId: session!.societyId,
        flatId: flat?.id || null,
        flatNumber,
        visitorName,
        phone: phone || null,
        purpose,
        vehicleNo: vehicleNo || null,
        approvedBy: session.name,
        notes: notes || null,
      },
    });

    await logCreated("visitor", visitor.id, `${visitorName} → Flat ${flatNumber}`, {
      purpose,
      vehicleNo,
    });

    return Response.json({ visitor }, { status: 201 });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/visitors", nestPath: "/api/v1/operations/visitors", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/visitors", nestPath: "/api/v1/operations/visitors", method: "POST" }, legacyPOST);
