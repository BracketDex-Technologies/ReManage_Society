import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/assets";
const NEST_GET = "/api/v1/operations/assets/list";
const NEST_POST = "/api/v1/operations/assets/create";

async function legacyGET() {
  const { error, status, session } = await requireAdmin();
  if (error) return Response.json({ error }, { status });

  const assets = await prisma.societyAsset.findMany({
    where: { societyId: session!.societyId },
    orderBy: { name: "asc" },
  });

  return Response.json(assets);
}

async function legacyPOST(request: Request) {
  const { error, status, session } = await requireAdmin();
  if (error) return Response.json({ error }, { status });

  const body = await request.json();
  const {
    name, category, location, purchaseDate, purchaseAmount,
    currentValue, warrantyEnd, vendor, serialNumber, condition,
    maintenanceCycle, notes,
  } = body;

  if (!name || !category) {
    return Response.json({ error: "Name and category are required" }, { status: 400 });
  }

  const asset = await prisma.societyAsset.create({
    data: {
      societyId: session!.societyId,
      name,
      category,
      location: location || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount) : null,
      currentValue: currentValue ? parseFloat(currentValue) : null,
      warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null,
      vendor: vendor || null,
      serialNumber: serialNumber || null,
      condition: condition || "good",
      maintenanceCycle: maintenanceCycle ? parseInt(maintenanceCycle) : null,
      notes: notes || null,
    },
  });

  return Response.json(asset, { status: 201 });
}

export const GET = shimOrFallback({ legacyRoute: "/api/assets", nestPath: "/api/v1/operations/assets", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/assets", nestPath: "/api/v1/operations/assets", method: "POST" }, legacyPOST);
