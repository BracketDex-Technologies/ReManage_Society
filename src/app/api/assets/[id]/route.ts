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

const LEGACY_ROUTE = "/api/assets/[id]";
const NEST_GET = "/api/v1/operations/assets/detail/get";
const NEST_PATCH = "/api/v1/operations/assets/detail/update";
const NEST_DELETE = "/api/v1/operations/assets/detail/remove";

async function legacyPATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, session } = await requireAdmin();
  if (error) return Response.json({ error }, { status });

  const { id } = await params;
  const body = await request.json();

  const asset = await prisma.societyAsset.findFirst({
    where: { id, societyId: session!.societyId },
  });

  if (!asset) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const updated = await prisma.societyAsset.update({
    where: { id },
    data: {
      ...body,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : asset.purchaseDate,
      warrantyEnd: body.warrantyEnd ? new Date(body.warrantyEnd) : asset.warrantyEnd,
      lastMaintenanceAt: body.lastMaintenanceAt ? new Date(body.lastMaintenanceAt) : asset.lastMaintenanceAt,
      nextMaintenanceAt: body.nextMaintenanceAt ? new Date(body.nextMaintenanceAt) : asset.nextMaintenanceAt,
      purchaseAmount: body.purchaseAmount ? parseFloat(body.purchaseAmount) : asset.purchaseAmount,
      currentValue: body.currentValue ? parseFloat(body.currentValue) : asset.currentValue,
    },
  });

  return Response.json(updated);
}

async function legacyDELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, session } = await requireAdmin();
  if (error) return Response.json({ error }, { status });

  const { id } = await params;

  await prisma.societyAsset.deleteMany({
    where: { id, societyId: session!.societyId },
  });

  return Response.json({ success: true });
}

export const PATCH = shimOrFallback({ legacyRoute: "/api/assets", nestPath: "/api/v1/operations/assets", method: "PATCH" }, legacyPATCH);
export const DELETE = shimOrFallback({ legacyRoute: "/api/assets", nestPath: "/api/v1/operations/assets", method: "DELETE" }, legacyDELETE);
